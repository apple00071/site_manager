import { Resend } from 'resend';

export const sendWelcomeEmail = async (
    to: string,
    fullName: string,
    username: string,
    tempPassword: string,
    loginLink: string
) => {
    if (!process.env.RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured. Skipping welcome email.');
        return false;
    }

    try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        
        const origin = new URL(loginLink).origin;
        
        // Email clients can't load images from localhost, use a public fallback for local testing
        const logoUrl = origin.includes('localhost') 
            ? 'https://raw.githubusercontent.com/apple00071/site_manager/master/public/New-logo.png' 
            : `${origin}/New-logo.png`;
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <img src="${logoUrl}" alt="Apple Interior Manager" style="max-height: 80px; max-width: 100%;">
                </div>
                <h2 style="color: #333; text-align: center;">Welcome to Apple Interior Manager!</h2>
                <p>Hello ${fullName},</p>
                <p>Your account has been created successfully. Below are your login credentials:</p>
                
                <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                    <p style="margin: 5px 0;"><strong>Username:</strong> ${username}</p>
                    <p style="margin: 5px 0;"><strong>Password:</strong> ${tempPassword}</p>
                </div>
                
                <p>Please log in and change your password from the Settings page as soon as possible.</p>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${loginLink}" style="background-color: #eab308; color: #fff; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Log In Now</a>
                </div>
                
                <div style="text-align: center; margin: 30px 0; padding-top: 20px; border-top: 1px solid #eee;">
                    <p style="margin-bottom: 10px; font-weight: bold; color: #555;">Download our mobile app:</p>
                    <a href="https://play.google.com/store/apps/details?id=co.median.android.xllydaj&hl=en_IN" style="display: inline-block;">
                        <img src="https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png" alt="Get it on Google Play" style="height: 60px;">
                    </a>
                </div>
                
                <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center;">
                    <p style="color: #555; font-size: 14px; font-weight: bold; margin-bottom: 5px;">Need help?</p>
                    <p style="color: #666; font-size: 14px; margin: 0;">For any issues, please contact Pavan (8247494622)</p>
                </div>
                
                <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">If you did not expect this email, please ignore it.</p>
            </div>
        `;

        const { data, error } = await resend.emails.send({
            from: process.env.FROM_EMAIL || 'Apple Interior Manager <onboarding@resend.dev>',
            to,
            subject: 'Welcome to Apple Interior Manager - Your Login Details',
            html,
        });

        if (error) {
            console.error('Error from Resend API:', error);
            return false;
        }

        console.log('Welcome email sent successfully:', data?.id);
        return true;
    } catch (error) {
        console.error('Unexpected error sending welcome email:', error);
        return false;
    }
};
