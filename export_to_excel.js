const { createClient } = require('@supabase/supabase-js');
const xlsx = require('xlsx');
const fs = require('fs');
const path = require('path');
const https = require('https');

// Initialize Supabase
const supabaseUrl = 'https://uswdtcmemgfqlkzmfkxs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVzd2R0Y21lbWdmcWxrem1ma3hzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTMzNzg1OCwiZXhwIjoyMDc2OTEzODU4fQ.4k5EGYhCQ1V3WvxjIHCfoPdRnw7CBhWIiSmkhqRJNKA';
const supabase = createClient(supabaseUrl, supabaseKey);

const exportDir = path.join(__dirname, 'project_exports');
if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir);
}

const safeFilename = (name) => name.replace(/[/\\?%*:|"<>]/g, '-');

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close(resolve);
                });
            } else {
                fs.unlink(dest, () => reject(new Error(`Server responded with ${response.statusCode}: ${response.statusMessage}`)));
            }
        }).on('error', (err) => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

// Extract filenames from URLs
const extractFilename = (urlStr) => {
    try {
        const parsed = new URL(urlStr);
        let name = path.basename(parsed.pathname);
        return decodeURIComponent(name) || `file_${Date.now()}`;
    } catch {
        return `file_${Date.now()}`;
    }
};

async function getUserIdToNameMap() {
    const { data: users, error } = await supabase.from('users').select('id, full_name, first_name, last_name, email');
    if (error) {
        console.error('Error fetching users:', error);
        return {};
    }
    const map = {};
    for (const u of users) {
        map[u.id] = u.full_name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email;
    }
    return map;
}

const userKeys = ['created_by', 'updated_by', 'assigned_employee_id', 'user_id', 'client_id'];

function resolveUserNames(dataArray, userMap) {
    return dataArray.map(row => {
        const newRow = { ...row };
        for (const [key, val] of Object.entries(newRow)) {
            if (userKeys.includes(key) && val && userMap[val]) {
                newRow[key] = `${userMap[val]} (${val})`; // Keep UUID in parens or just use Name
                newRow[`${key}_name`] = userMap[val];
            } else if (key === 'project_id') {
                // skip
            }
        }
        return newRow;
    });
}

// Fields that might contain storage arrays
const imageArrayFields = ['images', 'photos'];
const imageSingleFields = ['file_url', 'thumbnail_url'];

async function processAndDownloadImages(dataArray, projectImagesDir) {
    if (!dataArray || dataArray.length === 0) return;

    for (const row of dataArray) {
        let urlsToDownload = [];

        // Check array fields
        for (const field of imageArrayFields) {
            if (Array.isArray(row[field])) {
                urlsToDownload.push(...row[field].filter(u => typeof u === 'string' && u.startsWith('http')));
            }
        }

        // Check single string fields
        for (const field of imageSingleFields) {
            if (typeof row[field] === 'string' && row[field].startsWith('http')) {
                urlsToDownload.push(row[field]);
            }
        }

        for (const url of urlsToDownload) {
            // Only download from supabase storage
            if (url.includes('supabase.co') && url.includes('/storage/v1/object/public/')) {
                const fName = extractFilename(url);
                const destPath = path.join(projectImagesDir, fName);
                if (!fs.existsSync(destPath)) {
                    console.log(`    Downloading image: ${fName}`);
                    try {
                        await downloadFile(url, destPath);
                    } catch (err) {
                        console.error(`    Failed to download ${url}:`, err.message);
                    }
                }
            }
        }
    }
}

async function exportProjects() {
    console.log('Fetching user mapping...');
    const userMap = await getUserIdToNameMap();

    console.log('Fetching projects...');
    const { data: projects, error: projErr } = await supabase.from('projects').select('*');
    if (projErr) return console.error('Error fetching projects:', projErr.message);

    console.log(`Found ${projects.length} projects. Exporting...`);

    for (const project of projects) {
        const safeTitle = project.title ? project.title : 'Untitled';
        const projNameStr = `${safeFilename(safeTitle)}_${project.id.split('-')[0]}`;
        console.log(`Processing project: ${projNameStr}...`);

        // Create project specific folder
        const projDir = path.join(exportDir, projNameStr);
        if (!fs.existsSync(projDir)) fs.mkdirSync(projDir);

        const imgDir = path.join(projDir, 'images');
        if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir);

        const wb = xlsx.utils.book_new();

        // 1. Overview Sheet
        const overviewData = resolveUserNames([project], userMap);
        const overviewSheet = xlsx.utils.json_to_sheet(overviewData);
        xlsx.utils.book_append_sheet(wb, overviewSheet, 'Overview');

        // Helper to process a table
        async function processTable(tableName, sheetName) {
            const { data } = await supabase.from(tableName).select('*').eq('project_id', project.id);
            if (data && data.length > 0) {
                const resolved = resolveUserNames(data, userMap);
                await processAndDownloadImages(resolved, imgDir);
                xlsx.utils.book_append_sheet(wb, xlsx.utils.json_to_sheet(resolved), sheetName);
            }
        }

        await processTable('tasks', 'Tasks');
        await processTable('inventory_items', 'Inventory');
        await processTable('boq_items', 'BOQ_Items');
        await processTable('snags', 'Snags');
        await processTable('project_updates', 'Updates');
        await processTable('project_members', 'Members');
        await processTable('handover_checklists', 'Handover_Checklist');
        await processTable('workflow_history', 'Workflow_History');

        // Also include design_files
        await processTable('design_files', 'Design_Files');

        // Save workbook inside the project folder
        const filepath = path.join(projDir, `${projNameStr}_Data.xlsx`);
        xlsx.writeFile(wb, filepath);

        console.log(`Saved ${filepath}`);
    }

    console.log(`Export complete! All files saved in ${exportDir}`);
}

exportProjects().catch(console.error);
