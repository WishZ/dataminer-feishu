# Cloudflare Workers Deployment Guide

This guide explains how to deploy the DataMiner Feishu application to Cloudflare Workers.

## Prerequisites

1. **Cloudflare Account**: Sign up at [cloudflare.com](https://cloudflare.com)
2. **Node.js**: Version 16 or higher
3. **Wrangler CLI**: Will be installed automatically

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Deploy to Staging

```bash
npm run deploy:staging
```

### 4. Deploy to Production

```bash
npm run deploy:production
```

## Available Scripts

- `npm run build:worker` - Build the worker and generate assets manifest
- `npm run worker:dev` - Start local development server
- `npm run worker:preview` - Preview worker locally
- `npm run deploy` - Deploy to default environment (staging)
- `npm run deploy:staging` - Deploy to staging environment
- `npm run deploy:production` - Deploy to production environment

## Configuration

### Environment Variables

Set environment variables using Wrangler secrets:

```bash
# Optional: Set custom API base URL
npx wrangler secret put SNAPPDOWN_API_BASE_URL

# Set any other required secrets
npx wrangler secret put YOUR_SECRET_NAME
```

### Custom Domain

1. Go to your Cloudflare dashboard
2. Navigate to Workers & Pages
3. Select your worker
4. Go to Settings > Triggers
5. Add a custom domain

### Environments

The project supports multiple environments:

- **staging**: `dataminer-feishu-staging.your-subdomain.workers.dev`
- **production**: `dataminer-feishu-prod.your-subdomain.workers.dev`

## Architecture

The Cloudflare Worker handles:

1. **Static File Serving**: Serves the React application files
2. **API Proxying**: Proxies requests to the Snappdown API
3. **CORS Handling**: Adds proper CORS headers
4. **SPA Routing**: Handles client-side routing

## File Structure

```
├── worker/
│   ├── index.js              # Main worker script
│   └── assets-manifest.json  # Generated assets manifest
├── scripts/
│   ├── build-worker.js       # Build script
│   └── deploy.sh            # Deployment script
├── wrangler.toml            # Cloudflare Workers configuration
└── dist/                    # Built React application
```

## Development

### Local Development

```bash
# Start local development server
npm run worker:dev

# Or preview locally without external API calls
npm run worker:preview
```

### Testing

Test your deployment:

1. Visit your worker URL
2. Test API endpoints: `https://your-worker.workers.dev/api/test`
3. Verify static file serving works correctly

## Troubleshooting

### Common Issues

1. **Build Errors**: Ensure `npm run build` completes successfully first
2. **Large Bundle Size**: Workers have a 1MB limit. Consider code splitting if needed
3. **API Errors**: Check CORS configuration and API endpoint URLs

### Debugging

View logs in real-time:

```bash
npx wrangler tail
```

### Performance

- Static assets are cached with appropriate headers
- API responses include CORS headers
- Binary files are properly encoded/decoded

## Security

- API keys are handled securely through Wrangler secrets
- CORS is configured to allow necessary origins
- No sensitive data is exposed in the worker code

## Monitoring

Monitor your worker in the Cloudflare dashboard:

1. Go to Workers & Pages
2. Select your worker
3. View metrics, logs, and performance data

## Support

For issues related to:
- **Cloudflare Workers**: Check [Cloudflare Workers docs](https://developers.cloudflare.com/workers/)
- **Application**: Check the main README.md
- **API**: Contact Snappdown support
