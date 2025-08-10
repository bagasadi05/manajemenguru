# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Testing

To generate coverage reports:

1. Run `npm test` to execute the tests with coverage.
2. After the run, open `coverage/lcov-report/index.html` in a browser to view the full report.

