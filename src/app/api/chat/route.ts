import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';
import { NotificationService } from '@/lib/notificationService';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate user
    const { user, error: authError, role: userRole } = await getAuthUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;
    const role = userRole || 'employee';
    const isAdmin = role === 'admin';

    // 2. Parse request body
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages array is required' }, { status: 400 });
    }

    const lastMessage = messages[messages.length - 1]?.content || '';

    // Check for API Keys
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;

    // 3. Query accessible database context
    const { data: usersList } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, role, designation, is_active');

    const activeUsersList = usersList?.filter((u: any) => u.is_active !== false) || [];

    const userMap: Record<string, string> = {};
    usersList?.forEach((u: any) => {
      userMap[u.id] = `${u.full_name} (${u.designation || u.role})`;
    });

    let projects: any[] = [];
    let steps: any[] = [];
    let tasks: any[] = [];
    let snags: any[] = [];
    let clients: any[] = [];
    let projectUpdates: any[] = [];
    let designFiles: any[] = [];
    let inventoryItems: any[] = [];
    let leavesList: any[] = [];

    if (isAdmin) {
      const [projectsRes, stepsRes, tasksRes, snagsRes, clientsRes, updatesRes, designsRes, inventoryRes, leavesRes] = await Promise.all([
        supabaseAdmin.from('projects').select('*').order('created_at', { ascending: false }),
        supabaseAdmin.from('project_steps').select('*'),
        supabaseAdmin.from('project_step_tasks').select('*'),
        supabaseAdmin.from('snags').select('*'),
        supabaseAdmin.from('clients').select('*'),
        supabaseAdmin.from('project_updates').select('*').order('update_date', { ascending: false }).limit(150),
        supabaseAdmin.from('design_files').select('*').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('inventory_items').select('*').order('created_at', { ascending: false }).limit(100),
        supabaseAdmin.from('leaves').select('*').order('created_at', { ascending: false }).limit(50)
      ]);

      projects = projectsRes.data || [];
      steps = stepsRes.data || [];
      tasks = tasksRes.data || [];
      snags = snagsRes.data || [];
      clients = clientsRes.data || [];
      projectUpdates = updatesRes.data || [];
      designFiles = designsRes.data || [];
      inventoryItems = inventoryRes.data || [];
      leavesList = leavesRes.data || [];
    } else {
      const [memberProjects, assignedProjects, designerProjects] = await Promise.all([
        supabaseAdmin.from('project_members').select('project_id').eq('user_id', userId),
        supabaseAdmin.from('projects').select('id').eq('assigned_employee_id', userId),
        supabaseAdmin.from('projects').select('id').eq('designer_id', userId)
      ]);

      const memberIds = memberProjects.data?.map((p: any) => p.project_id) || [];
      const assignedIds = assignedProjects.data?.map((p: any) => p.id) || [];
      const designerIds = designerProjects.data?.map((p: any) => p.id) || [];

      const allowedProjectIds = [...new Set([...memberIds, ...assignedIds, ...designerIds])];

      if (allowedProjectIds.length > 0) {
        const [projectsRes, stepsRes, snagsRes, updatesRes, designsRes, inventoryRes, leavesRes] = await Promise.all([
          supabaseAdmin.from('projects').select('*').in('id', allowedProjectIds).order('created_at', { ascending: false }),
          supabaseAdmin.from('project_steps').select('*').in('project_id', allowedProjectIds),
          supabaseAdmin.from('snags').select('*').or(`project_id.in.(${allowedProjectIds.join(',')}),assigned_to_user_id.eq.${userId},created_by.eq.${userId}`),
          supabaseAdmin.from('project_updates').select('*').in('project_id', allowedProjectIds).order('update_date', { ascending: false }).limit(150),
          supabaseAdmin.from('design_files').select('*').in('project_id', allowedProjectIds).order('created_at', { ascending: false }).limit(100),
          supabaseAdmin.from('inventory_items').select('*').in('project_id', allowedProjectIds).order('created_at', { ascending: false }).limit(100),
          supabaseAdmin.from('leaves').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
        ]);

        projects = projectsRes.data || [];
        steps = stepsRes.data || [];
        snags = snagsRes.data || [];
        projectUpdates = updatesRes.data || [];
        designFiles = designsRes.data || [];
        inventoryItems = inventoryRes.data || [];
        leavesList = leavesRes.data || [];

        const stepIds = steps.map((s: any) => s.id);
        if (stepIds.length > 0) {
          const tasksRes = await supabaseAdmin.from('project_step_tasks').select('*').in('step_id', stepIds);
          tasks = tasksRes.data || [];
        }

        const clientIds = projects.map((p: any) => p.client_id).filter(Boolean);
        if (clientIds.length > 0) {
          const clientsRes = await supabaseAdmin.from('clients').select('*').in('id', clientIds);
          clients = clientsRes.data || [];
        }
      } else {
        const [snagsRes, leavesRes] = await Promise.all([
          supabaseAdmin.from('snags').select('*').or(`assigned_to_user_id.eq.${userId},created_by.eq.${userId}`),
          supabaseAdmin.from('leaves').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
        ]);
        snags = snagsRes.data || [];
        leavesList = leavesRes.data || [];
      }
    }

    // Local rule-based fallback response engine
    const generateLocalResponse = (userQuery: string) => {
      const query = userQuery.toLowerCase();
      
      if (query.includes('project')) {
        if (projects.length === 0) {
          return "You don't have any active projects assigned in the database.";
        }
        const list = projects.map(p => `- **${p.title}** | Status: \`${p.status}\` | Customer: ${p.customer_name}`).join('\n');
        return `### Assigned Projects\nHere are the projects found in your database profile:\n\n${list}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }
      
      if (query.includes('task')) {
        if (tasks.length === 0) {
          return "No active tasks found in the database.";
        }
        const list = tasks.slice(0, 10).map(t => `- **${t.title}** | Status: \`${t.status}\``).join('\n');
        return `### Active Tasks\nHere are the tasks in the database:\n\n${list}${tasks.length > 10 ? '\n- ...and more.' : ''}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }
      
      if (query.includes('snag') || query.includes('defect') || query.includes('issue')) {
        if (snags.length === 0) {
          return "Great! No unresolved snags or defects found in your database profile.";
        }
        const list = snags.map((s: any) => `- **${s.description}** | Status: \`${s.status}\` | Priority: \`${s.priority}\``).join('\n');
        return `### Active Snags\nHere are the snags reported in the database:\n\n${list}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }
      
      if (query.includes('team') || query.includes('member') || query.includes('user') || query.includes('people')) {
        if (activeUsersList.length === 0) {
          return "No team members found.";
        }
        const list = activeUsersList.map((u: any) => `- **${u.full_name}** | Role: \`${u.role}\` | Email: ${u.email}`).join('\n');
        return `### Team Directory\nHere are the team profiles in the database:\n\n${list}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }

      if (query.includes('progress') || query.includes('update')) {
        if (projectUpdates.length === 0) {
          return "No site progress updates found in the database.";
        }
        const list = projectUpdates.slice(0, 15).map(u => {
          const updater = u.user_id ? userMap[u.user_id] : (u.sender_name || 'System');
          return `- **${u.update_date}**: "${u.description}" | Posted by: ${updater}`;
        }).join('\n');
        return `### Recent Progress Updates\nHere are the recent site updates in the database:\n\n${list}${projectUpdates.length > 15 ? '\n- ...and more.' : ''}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }

      if (query.includes('expense') || query.includes('bill') || query.includes('cost')) {
        if (inventoryItems.length === 0) {
          return "No project expenses or bills found in the database.";
        }
        const list = inventoryItems.slice(0, 15).map(i => {
          const creator = i.created_by ? userMap[i.created_by] : 'Unknown';
          const billLink = i.bill_urls && i.bill_urls.length > 0 
            ? `[View Bill](${i.bill_urls[0]})` 
            : i.bill_url 
              ? `[View Bill](${i.bill_url})` 
              : 'No Bill';
          return `- **${i.item_name}**: ₹${i.total_cost || 0} | Date: ${i.date_purchased || 'N/A'} | Status: ${i.bill_approval_status || 'N/A'} | Bill: ${billLink} (Added by: ${creator})`;
        }).join('\n');
        return `### Project Expenses & Bills\nHere are the recent project expenses in the database:\n\n${list}${inventoryItems.length > 15 ? '\n- ...and more.' : ''}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }

      if (query.includes('design') || query.includes('drawing')) {
        if (designFiles.length === 0) {
          return "No design files found in the database.";
        }
        const list = designFiles.slice(0, 15).map(d => {
          const uploader = d.uploaded_by ? userMap[d.uploaded_by] : 'Unknown';
          return `- **[${d.file_name}](${d.file_url})** (${d.category || 'N/A'}): Status: \`${d.approval_status}\` | Uploaded by: ${uploader}`;
        }).join('\n');
        return `### Design Files\nHere are the recent design files in the database:\n\n${list}${designFiles.length > 15 ? '\n- ...and more.' : ''}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }

      if (query.includes('leave') || query.includes('holiday') || query.includes('absent')) {
        if (leavesList.length === 0) {
          return "No leave requests found in the database.";
        }
        const list = leavesList.slice(0, 15).map(l => {
          const applicant = userMap[l.user_id] || l.user_id;
          return `- **${applicant}**: ${l.leave_type} (${l.start_date} to ${l.end_date}) | Reason: "${l.reason}" | Status: \`${l.status}\``;
        }).join('\n');
        return `### Leave Requests\nHere are the leave requests in the database:\n\n${list}${leavesList.length > 15 ? '\n- ...and more.' : ''}\n\n*(Note: This is a local database query response because no active AI API key is configured)*`;
      }

      return `### Offline Database Assistant
I am running in **Local Offline Mode** because no external AI API key (Anthropic, OpenAI, or Gemini) is active. 

I can still pull real data directly from your database! Try querying me about:
- **"projects"** to list all assigned projects
- **"tasks"** to list your current tasks
- **"snags"** to list reported defects
- **"team"** to list team members
- **"progress"** to list recent site updates
- **"expenses"** to check project bills
- **"designs"** to check project design approvals
- **"leaves"** to check employee leave records`;
    };

    // If no keys are configured, fallback to local engine
    if (!anthropicKey && !geminiKey && !openaiKey) {
      return NextResponse.json({ response: generateLocalResponse(lastMessage), provider: 'Local Database Engine' });
    }

    // 4. Format context details as readable markdown summary
    const clientMap: Record<string, string> = {};
    clients.forEach((c: any) => {
      clientMap[c.id] = `${c.name} (Phone: ${c.phone || 'N/A'}, Email: ${c.email || 'N/A'})`;
    });

    const projectMarkdownList = projects.map((p: any) => {
      const projClient = p.client_id ? clientMap[p.client_id] : p.customer_name;
      const designerName = p.assigned_employee_id ? userMap[p.assigned_employee_id] : 'Not Assigned';
      
      const projSteps = steps.filter((s: any) => s.project_id === p.id);
      const stepDetails = projSteps.map((s: any) => {
        const stepTasks = tasks.filter((t: any) => t.step_id === s.id);
        const taskDetails = stepTasks.map((t: any) => {
          const rawAssignees = Array.isArray(t.assigned_to) ? t.assigned_to : (t.assigned_to ? [t.assigned_to] : []);
          const assignees = rawAssignees.map((id: string) => userMap[id] || id).join(', ');
          return `      - Task: "${t.title}" | Status: ${t.status} | Assigned to: [${assignees || 'None'}]`;
        }).join('\n');

        return `    * Step: "${s.title}" | Status: ${s.status || 'pending'}\n${taskDetails || '      (No tasks in this step)'}`;
      }).join('\n');

      const projSnags = snags.filter((snag: any) => snag.project_id === p.id);
      const snagDetails = projSnags.map((snag: any) => {
        const assigned = snag.assigned_to_user_id ? userMap[snag.assigned_to_user_id] : 'Unassigned';
        return `    * Snag: "${snag.description}" | Status: ${snag.status} | Severity: ${snag.priority} | Location: ${snag.location || 'N/A'} | Assigned to: ${assigned}`;
      }).join('\n');

      const projUpdates = projectUpdates.filter((u: any) => u.project_id === p.id);
      const updateDetails = projUpdates.map((u: any) => {
        const updaterName = u.user_id ? userMap[u.user_id] : (u.sender_name || 'System');
        return `    * Update on ${u.update_date}: "${u.description}" | Posted by: ${updaterName}`;
      }).join('\n');

      const projDesigns = designFiles.filter((d: any) => d.project_id === p.id);
      const designDetails = projDesigns.map((d: any) => {
        const uploader = d.uploaded_by ? userMap[d.uploaded_by] : 'Unknown';
        return `    * Design: [${d.file_name}](${d.file_url}) | Category: ${d.category || 'N/A'} | Status: ${d.approval_status} | Uploaded by: ${uploader}`;
      }).join('\n');

      const projExpenses = inventoryItems.filter((i: any) => i.project_id === p.id);
      const expenseDetails = projExpenses.map((i: any) => {
        const creator = i.created_by ? userMap[i.created_by] : 'Unknown';
        const billLink = i.bill_urls && i.bill_urls.length > 0 
          ? `[View Bill](${i.bill_urls[0]})` 
          : i.bill_url 
            ? `[View Bill](${i.bill_url})` 
            : 'No Bill';
        return `    * Expense: "${i.item_name}" | Cost: ₹${i.total_cost || 0} | Date: ${i.date_purchased || 'N/A'} | Bill Status: ${i.bill_approval_status || 'N/A'} | Bill Link: ${billLink} | Added by: ${creator}`;
      }).join('\n');

      return `- Project: "${p.title}"
  * ID: ${p.id}
  * Status: ${p.status}
  * Stage: ${p.workflow_stage || 'N/A'}
  * Client/Customer: ${projClient}
  * Address: ${p.address || 'N/A'}
  * Designer/In-charge: ${designerName}
  * Start Date: ${p.start_date || 'N/A'}
  * Estimated Completion: ${p.estimated_completion_date || 'N/A'}
  * Steps & Tasks:\n${stepDetails || '    (No stages defined yet)'}
  * Project Snags:\n${snagDetails || '    (No snags reported)'}
  * Recent Progress Updates:\n${updateDetails || '    (No progress updates reported)'}
  * Project Design Files:\n${designDetails || '    (No design files uploaded)'}
  * Project Expenses / Bills:\n${expenseDetails || '    (No expenses/bills reported)'}`;
    }).join('\n\n');

    const globalSnags = snags.filter((s: any) => !s.project_id);
    const globalSnagMarkdown = globalSnags.map((snag: any) => {
      const assigned = snag.assigned_to_user_id ? userMap[snag.assigned_to_user_id] : 'Unassigned';
      return `- Snag: "${snag.description}"
  * Status: ${snag.status}
  * Severity: ${snag.priority}
  * Site/Client: ${snag.site_name || snag.client_name || 'N/A'}
  * Assigned to: ${assigned}`;
    }).join('\n');

    const systemPrompt = `You are a helpful and intelligent AI Assistant for the "Apple Interior Manager" system.
Your goal is to help users query, analyze, and understand the project data they have access to.

Here is the current authorized database context for the logged-in user (${user.email}, Role: ${role}):

### SYSTEM DATA CONTEXT

Available Team Members (Users):
${activeUsersList.map((u: any) => `- Name: ${u.full_name} | Role: ${u.role} | Designation: ${u.designation || 'N/A'} | Email: ${u.email} | ID: ${u.id}`).join('\n') || 'None'}

Projects, Tasks, and Project Snags:
${projectMarkdownList || 'No projects found or assigned.'}

Global / Unassigned Snags:
${globalSnagMarkdown || 'No global/unassigned snags.'}

Employee / Team Leave Requests:
${leavesList.map((l: any) => `- User: ${userMap[l.user_id] || l.user_id} | Type: ${l.leave_type} | Dates: ${l.start_date} to ${l.end_date} | Reason: "${l.reason}" | Status: ${l.status}`).join('\n') || 'None'}

### INSTRUCTIONS:
1. You MUST only answer questions based on the database data provided above.
2. If the user asks about data not present in the context or if you cannot find it, politely state that you don't have access to that information or that it doesn't exist in the system.
3. Be professional, direct, and present lists or summaries in clean markdown tables or bullets to make it extremely easy to read.
4. Keep the role of the user in mind. Do not expose data that is not present in their context.
5. If the user asks to modify data or execute operations (other than task creation), explain that you are a read-only assistant and guide them on where they can do it in the user interface (e.g., "You can update task status directly in the Projects tab of the dashboard").
6. When presenting design files or bill documents, you MUST preserve the markdown link format e.g. [filename](fileurl) or [View Bill](url) so the links are clickable for the user. Do not hide, format as code, or omit the URLs.
7. If the user explicitly asks you to create a task (e.g., "Create a task...", "Assign a task...", "Add a task to..."), you MUST output a special XML block at the very end of your response to trigger server-side task creation. The XML block must have the tag name "<create_task>" and contain a JSON payload adhering to the following schema:
   {
     "project_id": "UUID string (Look up the Project ID from the Projects list above, or set to null if it's a standalone task not associated with any project)",
     "step_title": "string (Optional: the stage or step name, e.g. 'Electrical', 'Woodwork', 'False Ceiling', 'Snagging', etc.)",
     "task_title": "string (Required: the title of the task)",
     "task_description": "string (Optional: description/details of the task)",
     "start_date": "YYYY-MM-DD (Optional: starting date, format: YYYY-MM-DD, or null)",
     "estimated_completion_date": "YYYY-MM-DD (Optional: due date, format: YYYY-MM-DD, or null)",
     "assigned_to": ["UUID string"] (Optional: array of team member User IDs from the Team Members list above to assign, or null/empty array)",
     "priority": "low" | "medium" | "high" | "urgent" (Optional: priority, defaults to 'medium')
   }
   
   Example:
   If the user says "Create task Boxing work under project Aparna Zicon and assign to Naresh", you would find "Aparna Zicon" project ID (e.g. "a1b2c3d4-...") and Naresh's user ID (e.g. "x1y2z3...") in the context, and output:
   Here is the text describing what you are doing...
   <create_task>
   {
     "project_id": "a1b2c3d4-...",
     "step_title": "General",
     "task_title": "Boxing work",
     "assigned_to": ["x1y2z3..."],
     "priority": "medium"
   }
   </create_task>

   If the user asks to create a task but didn't specify a title, or if you cannot find the requested project or assignee, do not output the tag; ask clarifying questions first.
   Explain what task you are creating in the text response preceding the block, but keep it clean. The XML block will be parsed and executed server-side, and stripped from the final user message.
`;

    // 5. Providers functions
    const callAnthropic = async () => {
      const formattedMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })).filter(msg => msg.content.trim() !== '');

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicKey!,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-opus-4-8',
          max_tokens: 1500,
          system: systemPrompt,
          messages: formattedMessages
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Anthropic Error (Status ${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.content?.[0]?.text || 'No response generated.';
    };

    const callGemini = async () => {
      const formattedGeminiMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      })).filter(msg => msg.parts[0].text.trim() !== '');

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey!}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: formattedGeminiMessages,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          }
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini Error (Status ${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    };

    const callOpenAI = async () => {
      const formattedOpenAIMessages = messages.map(msg => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content
      })).filter(msg => msg.content.trim() !== '');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey!}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          max_tokens: 1500,
          messages: [
            { role: 'system', content: systemPrompt },
            ...formattedOpenAIMessages
          ]
        })
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`OpenAI Error (Status ${response.status}): ${errText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content || 'No response generated.';
    };

    // 7. Execute routing & fallback logic
    let replyText = '';
    let usedProvider = '';

    // Order of execution: Anthropic -> OpenAI -> Gemini -> Local Fallback
    const providers = [
      { name: 'Anthropic Claude', key: anthropicKey, fn: callAnthropic },
      { name: 'OpenAI GPT', key: openaiKey, fn: callOpenAI },
      { name: 'Google Gemini', key: geminiKey, fn: callGemini }
    ];

    let success = false;
    for (const provider of providers) {
      if (provider.key) {
        try {
          usedProvider = provider.name;
          replyText = await provider.fn();
          success = true;
          break; // Stop at first successful provider
        } catch (err: any) {
          console.error(`${provider.name} failed:`, err.message);
        }
      }
    }

    if (!success) {
      console.warn('All configured AI providers failed. Falling back to local query engine.');
      return NextResponse.json({
        response: generateLocalResponse(lastMessage),
        provider: 'Local Database Engine (Fallback)'
      });
    }

    // Parse task creation if requested by AI
    const taskMatch = replyText.match(/<create_task>([\s\S]*?)<\/create_task>/);
    if (taskMatch) {
      const jsonStr = taskMatch[1].trim();
      try {
        const taskData = JSON.parse(jsonStr);
        const projectId = taskData.project_id === '' ? null : taskData.project_id;
        const taskTitle = taskData.task_title;
        const stepTitle = taskData.step_title;
        const taskDescription = taskData.task_description || null;
        const startDate = taskData.start_date || null;
        const estimatedCompletionDate = taskData.estimated_completion_date || null;
        const assignedTo = (taskData.assigned_to && taskData.assigned_to.length > 0) ? taskData.assigned_to : null;
        const priority = taskData.priority || 'medium';

        if (!taskTitle) {
          throw new Error('Task title is required but was not provided in the payload.');
        }

        // Handle step creation only if project_id and step_title are provided
        let stepId: string | null = null;
        if (projectId && stepTitle) {
          const { data: existingStep } = await supabaseAdmin
            .from('project_steps')
            .select('id')
            .eq('project_id', projectId)
            .eq('title', stepTitle)
            .single();

          if (existingStep) {
            stepId = existingStep.id;
          } else {
            // Create new step
            const { data: newStep, error: stepError } = await supabaseAdmin
              .from('project_steps')
              .insert({
                project_id: projectId,
                title: stepTitle,
                description: `Step created for task: ${taskTitle}`,
                created_by: userId,
              })
              .select('id')
              .single();

            if (stepError) {
              console.error('Error creating step:', stepError);
              throw new Error(`Failed to create project step: ${stepError.message}`);
            }
            stepId = newStep.id;
          }
        }

        // Create the task
        let taskInsertError;
        let taskResult;

        // Try inserting as array first
        const { data: taskArray, error: taskArrayError } = await supabaseAdmin
          .from('project_step_tasks')
          .insert({
            step_id: stepId,
            title: taskTitle,
            description: taskDescription,
            start_date: startDate,
            estimated_completion_date: estimatedCompletionDate,
            priority: priority,
            assigned_to: assignedTo, // array
            created_by: userId,
            status: 'todo',
          })
          .select(`
            *,
            step:project_steps(
              id,
              title,
              project:projects(
                id,
                title,
                customer_name,
                phone_number
              )
            )
          `)
          .single();

        if (taskArrayError && taskArrayError.message.includes('type uuid')) {
          // Fallback: the database is using the old schema with single UUID column
          const singleAssignee = (assignedTo && assignedTo.length > 0) ? assignedTo[0] : null;
          console.log(`Database is using single UUID column for assigned_to. Falling back to: ${singleAssignee}`);
          
          const { data: taskSingle, error: taskSingleError } = await supabaseAdmin
            .from('project_step_tasks')
            .insert({
              step_id: stepId,
              title: taskTitle,
              description: taskDescription,
              start_date: startDate,
              estimated_completion_date: estimatedCompletionDate,
              priority: priority,
              assigned_to: singleAssignee, // single uuid
              created_by: userId,
              status: 'todo',
            })
            .select(`
              *,
              step:project_steps(
                id,
                title,
                project:projects(
                  id,
                  title,
                  customer_name,
                  phone_number
                )
              )
            `)
            .single();

          if (taskSingleError) {
            taskInsertError = taskSingleError;
          } else {
            taskResult = taskSingle;
          }
        } else if (taskArrayError) {
          taskInsertError = taskArrayError;
        } else {
          taskResult = taskArray;
        }

        if (taskInsertError || !taskResult) {
          console.error('Error creating task:', taskInsertError);
          throw new Error(`Failed to insert task record: ${taskInsertError?.message}`);
        }

        const task = taskResult;

        // Send notifications
        try {
          let projectData = null;
          if (projectId) {
            const { data } = await supabaseAdmin
              .from('projects')
              .select('title, customer_name, created_by')
              .eq('id', projectId)
              .single();
            projectData = data;
          }

          // Notify all assigned users
          if (assignedTo && Array.isArray(assignedTo)) {
            for (const assigneeId of assignedTo) {
              if (assigneeId !== userId) {
                await NotificationService.notifyTaskAssigned(
                  assigneeId,
                  taskTitle,
                  projectData?.title || 'Standalone',
                  task.id
                );
              }
            }
          }

          // Notify project creator if current user is not admin
          const userFullName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
          if (!isAdmin && projectData && projectData.created_by !== userId) {
            await NotificationService.createNotification({
              userId: projectData.created_by,
              title: 'New Task Created',
              message: `${userFullName} created task "${taskTitle}" in project "${projectData.title}"`,
              type: 'project_update',
              relatedId: task.id,
              relatedType: 'task'
            });
          }
        } catch (notificationError) {
          console.error('Failed to send notifications during chat task creation:', notificationError);
        }

        // Clean reply and append confirmation block
        const displayPriority = priority.charAt(0).toUpperCase() + priority.slice(1);
        const displayProject = task?.step?.project?.title || 'Standalone';
        const displayStep = stepTitle || 'General';
        
        const cleanReply = replyText.replace(/<create_task>[\s\S]*?<\/create_task>/, `
        
✅ **Task created successfully!**
- **Title:** ${taskTitle}
- **Project:** ${displayProject}
- **Step/Stage:** ${displayStep}
- **Priority:** \`${displayPriority}\`
- **Status:** \`TODO\`
`);
        replyText = cleanReply;

      } catch (err: any) {
        console.error('Error processing chatbot task creation:', err);
        const cleanReply = replyText.replace(/<create_task>[\s\S]*?<\/create_task>/, `
        
❌ **Failed to create task.**
*Error details: ${err.message || 'Unknown database write error'}*
`);
        replyText = cleanReply;
      }
    }

    return NextResponse.json({ response: replyText, provider: usedProvider });
  } catch (error: any) {
    console.error('Unexpected error in /api/chat route:', error);
    return NextResponse.json({ error: 'Internal Server Error', message: error.message }, { status: 500 });
  }
}
