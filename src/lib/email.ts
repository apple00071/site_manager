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
        
        const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
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
                
                <p style="color: #777; font-size: 12px; text-align: center;">If you did not expect this email, please ignore it.</p>
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
