# SalonBook Server

Backend server for the SalonBook salon appointment booking platform.

## Project Overview

SalonBook is a salon appointment booking platform where customers can browse salon services, book appointments, make payments, and manage their bookings. Admins can manage services, users, appointments, and transactions.

## Technologies

- Node.js
- Express.js
- MongoDB
- Better Auth
- JWT
- Stripe
- ImgBB
- REST API

## Features

- User authentication with Better Auth
- Email/password authentication
- Google authentication
- Customer and admin role management
- JWT authentication and authorization
- Salon service management
- Appointment management
- User management
- Booking and cancellation
- Stripe payment integration
- Stripe webhook payment verification
- Transaction management
- Image upload with ImgBB
- Protected admin APIs
- Role-based access control

## API Features

- Authentication APIs
- Service APIs
- Appointment APIs
- User management APIs
- Payment APIs
- Image upload API
- Admin protected APIs

## Run Locally

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

The server runs locally at:

```text
http://localhost:5000
```

## Environment Variables

Create a `.env` file in the server project and configure the required environment variables.

Example variable names:

```env
PORT=
MONGODB_URI
BETTER_AUTH_SECRET
BETTER_AUTH_URL
CLIENT_URL
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
IMGBB_API_KEY
```

Never commit `.env` or any secret credentials to GitHub.

## Deployment

The backend is deployed on Render.

Live Server:

https://salonbook-server-unb6.onrender.com

## Security

- Protected routes use authentication middleware.
- Admin routes use role-based authorization.
- JWT tokens are verified on protected APIs.
- User passwords are handled through Better Auth.
- Stripe payments are verified through webhook events.
- Secret environment variables are not stored in the repository.

## Author

SalonBook — Salon Appointment Booking Platform