# Admin System Documentation

This document provides comprehensive information about the admin system, including setup procedures, access management, and security considerations.

## Initial Admin Setup

### Creating the First Admin User

1. Ensure environment variables are properly set in your `.env` file:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. Run the admin creation script:
   ```
   node scripts/create-admin.js
   ```

3. Follow the prompts to enter admin email, first name, last name, and password.

4. Store the generated credentials securely.

## Admin Access

### Login Procedure

1. Navigate to `/admin/login` in your browser
2. Enter the admin credentials created during setup
3. The system will verify both authentication and admin role before granting access

### Security Measures

- Rate limiting is implemented to prevent brute force attacks
- Session tokens are automatically refreshed for security
- Admin-only routes are protected with role-based access control
- All authentication attempts are logged for security auditing

## Admin Dashboard

The admin dashboard provides:

1. Overview statistics (users, projects, clients)
2. Recent user registrations
3. Quick access to management sections

### User Management

Admins can:
- View all users
- Create new users
- Edit user details
- Change user roles
- Disable user accounts

### Role-Based Access Control

The system implements two primary roles:
- **Admin**: Full system access including user management
- **Employee**: Limited access based on assigned projects

## Database Security

The Supabase database implements Row Level Security (RLS) policies that:

1. Restrict data access based on user roles
2. Prevent unauthorized data modification
3. Ensure data integrity across the application

## Troubleshooting

If you encounter login issues:
1. Verify the admin user exists in both auth and users tables
2. Ensure the user has the 'admin' role in the users table
3. Check Supabase connection settings
4. Review browser console for specific error messages

## Best Practices

1. Regularly rotate admin passwords
2. Use strong, unique passwords for admin accounts
3. Limit the number of admin users
4. Regularly audit admin actions through logs
5. Keep the Supabase service role key secure and never expose it client-side