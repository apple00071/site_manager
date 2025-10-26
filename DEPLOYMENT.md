# Apple Interior Manager Deployment Guide

This document outlines the steps required to deploy the Apple Interior Manager application to production.

## Prerequisites

- Node.js 18+ and npm
- Supabase account
- Vercel account (recommended for deployment)

## Database Setup

1. Create a new Supabase project
2. Run the database schema script:
   - Navigate to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase-schema.sql` into the editor
   - Execute the script to create all required tables and security policies

## Environment Variables

Set up the following environment variables in your deployment platform:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Deployment Steps

### Vercel Deployment (Recommended)

1. Connect your GitHub repository to Vercel
2. Configure the build settings:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`
3. Add the environment variables
4. Deploy the application

### Manual Deployment

1. Build the application:
   ```
   npm run build
   ```

2. Start the production server:
   ```
   npm start
   ```

## Post-Deployment Verification

1. Verify authentication works correctly
2. Check that all pages load properly
3. Test CRUD operations for projects and clients
4. Verify role-based access control is functioning

## Security Considerations

- Ensure RLS (Row Level Security) policies are properly configured in Supabase
- Regularly rotate the Supabase anon key
- Set up proper CORS configuration
- Enable rate limiting for authentication endpoints

## Monitoring and Maintenance

- Set up error logging with a service like Sentry
- Configure performance monitoring
- Establish a regular backup schedule for the database

## Troubleshooting

If you encounter issues during deployment:

1. Check the deployment logs
2. Verify environment variables are correctly set
3. Ensure database schema is properly initialized
4. Check for any CORS or authentication issues in the browser console