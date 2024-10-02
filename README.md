# Stratus

## About

**Stratus** is an AI chatbot interface that leverages productivity, enabling users to get things done faster than ever before.

## Setup

1. Clone the repository
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory with your API keys:

   ```env
   OPENAI_API_KEY=your_openai_api_key
   ANTHROPIC_API_KEY=your_anthropic_api_key
   ```

## Commands to run during development

Build TailwindCSS:

```bash
npx tailwindcss -i ./public/src/css/input.css -o ./public/dist/css/output.css --watch
```

Launch Development Server:

```bash
npm run dev
```

## Production

To start the server in production mode:

```bash
npm start
```

## Technologies Used

- Node.js
- Express.js
- React
- Tailwind CSS
- OpenAI API
- Anthropic API
