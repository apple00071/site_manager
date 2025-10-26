# Apple Interior Manager

A comprehensive interior design project management system built with Next.js and Supabase.

## Features

- **Authentication System**: Secure login with role-based access control
- **User Management**: Admin can create, edit, and manage users
- **Project Management**: Create and manage interior design projects
- **Client Management**: Maintain client information and relationships
- **File Management**: Upload and manage project files
- **Team Collaboration**: Assign team members to projects with specific permissions

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Form Handling**: React Hook Form with Zod validation
- **Styling**: Tailwind CSS with responsive design

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase account

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/apple-interior-manager.git
cd apple-interior-manager
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env.local` file in the root directory with the following variables:
```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

4. Set up the database
Run the SQL commands in `supabase-schema.sql` in your Supabase SQL editor.

5. Run the development server
```bash
npm run dev
```

## Deployment to Vercel

1. Push your code to a GitHub repository

2. Connect your repository to Vercel

3. Configure environment variables in Vercel:
   - NEXT_PUBLIC_SUPABASE_URL
   - NEXT_PUBLIC_SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

4. Deploy your application

## User Roles

- **Admin**: Full access to all features, including user management
- **Employee**: Access to assigned projects and tasks

## Project Structure

- `/src/app`: Next.js app router pages
- `/src/contexts`: React contexts for state management
- `/src/lib`: Utility functions and configurations
- `/public`: Static assets

## License

This project is licensed under the MIT License.
