# Replit.md

## Overview

This is a UBL voice support application that provides real-time AI-powered voice assistance with bilingual (English/Urdu) capabilities. The system uses OpenAI's Realtime API with WebRTC for low-latency voice communication, providing users with an interactive voice interface that can handle support queries in both languages.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite for fast development and bundling
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: Shadcn/UI component library built on Radix UI primitives with Tailwind CSS for styling
- **State Management**: TanStack Query (React Query) for server state management and API caching
- **Styling**: Tailwind CSS with custom CSS variables for theming, supporting dark mode
- **Font Support**: Multi-language typography including Noto Nastaliq Urdu for proper Urdu text rendering

### Backend Architecture
- **Server Framework**: Express.js with TypeScript running on Node.js
- **Build System**: ESBuild for production bundling, TSX for development execution
- **API Design**: RESTful endpoints with focus on WebRTC session management
- **Real-time Communication**: WebRTC integration with OpenAI's Realtime API for voice processing
- **Development Tools**: Vite middleware integration for hot module replacement in development

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Management**: In-memory storage with potential for PostgreSQL session store using connect-pg-simple
- **Schema Management**: Drizzle Kit for database migrations and schema management

### Authentication and Authorization
- **Session Storage**: Memory-based storage implementation with interface for future database integration
- **User Management**: Basic user schema with username/password fields
- **Validation**: Zod schemas for runtime type validation and form validation with React Hook Form

### External Service Integrations
- **AI Service**: OpenAI Realtime API for voice processing and conversation handling
- **Voice Communication**: WebRTC for real-time audio streaming with low latency
- **Session Management**: Ephemeral token system for secure API access with 1-minute token validity
- **Audio Processing**: Browser MediaDevices API for microphone access and audio handling

### Key Architectural Decisions

**Monorepo Structure**: Single repository with shared types and schemas between client and server, enabling type safety across the full stack while maintaining clear separation of concerns.

**Real-time Voice Processing**: Direct WebRTC connection to OpenAI's Realtime API eliminates the need for custom audio processing infrastructure, reducing complexity while providing professional-grade voice AI capabilities.

**Bilingual Support**: Built-in English/Urdu language support with proper font rendering and text direction handling, making the UBL application accessible to diverse user bases.

**Type Safety**: End-to-end TypeScript implementation with shared schemas ensures runtime type validation and reduces integration errors between frontend and backend.

**Component Architecture**: Shadcn/UI provides a consistent, accessible component system built on Radix primitives, enabling rapid UI development while maintaining design system consistency.

**Development Experience**: Hot module replacement, error overlays, and integrated development tools create an efficient development workflow with fast iteration cycles.