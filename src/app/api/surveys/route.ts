import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, supabaseAdmin } from '@/lib/supabase-server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/surveys
 * 1. If ?action=status: Check if the authenticated user has already submitted the survey
 * 2. If general GET: Returns all survey results (STRICTLY RESTRICTED TO 'IT' DESIGNATION ONLY)
 */
export async function GET(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const action = request.nextUrl.searchParams.get('action');

        // Check if user already submitted the survey
        if (action === 'status') {
            let hasSubmitted = false;

            // 1. Check in app_surveys table
            const { data: surveyData, error: surveyErr } = await supabaseAdmin
                .from('app_surveys')
                .select('id')
                .eq('user_id', user.id)
                .limit(1);

            if (!surveyErr && surveyData && surveyData.length > 0) {
                hasSubmitted = true;
            } else {
                // 2. Fallback check in user_activities table
                const { data: actData } = await supabaseAdmin
                    .from('user_activities')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('action', 'app_survey')
                    .limit(1);

                if (actData && actData.length > 0) {
                    hasSubmitted = true;
                }
            }

            return NextResponse.json({ hasSubmitted });
        }

        // =========================================================================
        // VIEW RESULTS: STRICT ACCESS CONTROL — ONLY "IT" DESIGNATION ALLOWED
        // =========================================================================
        const { data: userProfile, error: profileErr } = await supabaseAdmin
            .from('users')
            .select('id, full_name, email, designation, role')
            .eq('id', user.id)
            .single();

        if (profileErr || !userProfile) {
            return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }

        const designation = (userProfile.designation || '').trim().toLowerCase();
        const isIT = designation === 'it';

        if (!isIT) {
            return NextResponse.json(
                { error: 'Forbidden. Survey results are only accessible to team members with the IT designation.' },
                { status: 403 }
            );
        }

        // Fetch all surveys with user details
        let surveyList: any[] = [];

        // 1. Try querying dedicated app_surveys table
        const { data: surveys, error: surveyError } = await supabaseAdmin
            .from('app_surveys')
            .select(`
                id,
                user_id,
                issues,
                improvements,
                rating,
                category,
                created_at,
                users:user_id (
                    id,
                    full_name,
                    email,
                    designation,
                    role
                )
            `)
            .order('created_at', { ascending: false });

        if (!surveyError && surveys) {
            surveyList = surveys;
        } else if (surveyError?.code === '42P01' || surveyError) {
            // 2. Fallback: Query from user_activities where action = 'app_survey'
            const { data: activities } = await supabaseAdmin
                .from('user_activities')
                .select(`
                    id,
                    user_id,
                    path,
                    action,
                    created_at,
                    users:user_id (
                        id,
                        full_name,
                        email,
                        designation,
                        role
                    )
                `)
                .eq('action', 'app_survey')
                .order('created_at', { ascending: false });

            if (activities) {
                surveyList = activities.map((act: any) => {
                    let parsed: any = {};
                    try {
                        parsed = JSON.parse(act.path || '{}');
                    } catch (_) {}

                    return {
                        id: act.id,
                        user_id: act.user_id,
                        issues: parsed.issues || 'N/A',
                        improvements: parsed.improvements || 'N/A',
                        rating: parsed.rating || 5,
                        category: parsed.category || 'General',
                        created_at: act.created_at,
                        users: act.users
                    };
                });
            }
        }

        return NextResponse.json({
            surveys: surveyList,
            totalCount: surveyList.length,
            viewer: {
                id: userProfile.id,
                name: userProfile.full_name,
                designation: userProfile.designation
            }
        });
    } catch (err: any) {
        console.error('Error in GET /api/surveys:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/surveys
 * Submits a survey response for the authenticated user.
 * Open to ALL users.
 */
export async function POST(request: NextRequest) {
    try {
        const { user, error: authError } = await getAuthUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { issues, improvements, rating = 5, category = 'General' } = body;

        if (!issues || typeof issues !== 'string' || !issues.trim()) {
            return NextResponse.json({ error: 'Please specify the issues or challenges you are facing.' }, { status: 400 });
        }

        if (!improvements || typeof improvements !== 'string' || !improvements.trim()) {
            return NextResponse.json({ error: 'Please specify what should be improved.' }, { status: 400 });
        }

        const cleanIssues = issues.trim();
        const cleanImprovements = improvements.trim();
        const cleanRating = Math.max(1, Math.min(5, Number(rating) || 5));
        const cleanCategory = String(category || 'General').trim();

        // 1. Try inserting into app_surveys table
        const { error: insertError } = await supabaseAdmin
            .from('app_surveys')
            .insert({
                user_id: user.id,
                issues: cleanIssues,
                improvements: cleanImprovements,
                rating: cleanRating,
                category: cleanCategory,
            });

        // 2. If app_surveys table does not exist yet (code 42P01), fallback into user_activities
        if (insertError) {
            console.warn('app_surveys insert failed, saving to user_activities fallback:', insertError.message);
            const { error: fallbackError } = await supabaseAdmin
                .from('user_activities')
                .insert({
                    user_id: user.id,
                    action: 'app_survey',
                    path: JSON.stringify({
                        issues: cleanIssues,
                        improvements: cleanImprovements,
                        rating: cleanRating,
                        category: cleanCategory,
                    })
                });

            if (fallbackError) {
                console.error('Fallback survey insert failed:', fallbackError);
                return NextResponse.json({ error: 'Failed to record survey response' }, { status: 500 });
            }
        }

        return NextResponse.json({ success: true, message: 'Survey submitted successfully' }, { status: 201 });
    } catch (err: any) {
        console.error('Error in POST /api/surveys:', err);
        return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
    }
}
