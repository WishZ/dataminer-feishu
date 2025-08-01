/**
 * Cloudflare Worker for DataMiner Feishu Application
 * Handles static file serving and API proxying
 */

// Import the static assets manifest (will be generated during build)
import ASSET_MANIFEST from './assets-manifest.json';

const SNAPPDOWN_API_BASE = 'https://data.snappdown.com/api';
const SNAPPDOWN_PROXY_BASE = 'https://snappdown.com/api';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle API proxy requests
    if (pathname.startsWith('/api/')) {
      return handleApiProxy(request, env);
    }

    // Handle static file serving
    return handleStaticFiles(request, env);
  },
};

/**
 * Handle API proxy requests to Snappdown API
 */
async function handleApiProxy(request, env) {
  try {
    const url = new URL(request.url);
    const apiPath = url.pathname.replace('/api', '');

    // Determine target base URL based on the path
    let targetBaseUrl = SNAPPDOWN_API_BASE;
    if (apiPath.startsWith('/proxy/media') || apiPath.startsWith('/download/proxy')) {
      targetBaseUrl = SNAPPDOWN_PROXY_BASE;
    }

    const targetUrl = `${targetBaseUrl}${apiPath}${url.search}`;

    // Clone the request to modify it
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    // Add CORS headers for preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Forward the request to the target API
    const response = await fetch(modifiedRequest);
    
    // Clone the response to modify headers
    const modifiedResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        ...Object.fromEntries(response.headers),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
      },
    });

    return modifiedResponse;
  } catch (error) {
    console.error('API proxy error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'API proxy error: ' + error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

/**
 * Handle static file serving
 */
async function handleStaticFiles(request, env) {
  const url = new URL(request.url);
  let pathname = url.pathname;

  // Default to index.html for root path
  if (pathname === '/') {
    pathname = '/index.html';
  }

  // For SPA routing, serve index.html for non-asset paths
  if (!pathname.includes('.') && pathname !== '/index.html') {
    pathname = '/index.html';
  }

  try {
    // Try to get the file from the assets manifest
    const assetKey = pathname.startsWith('/') ? pathname.slice(1) : pathname;
    const assetContent = ASSET_MANIFEST[assetKey];

    if (!assetContent) {
      // File not found, serve index.html for SPA routing
      const indexContent = ASSET_MANIFEST['index.html'];
      if (indexContent) {
        return new Response(indexContent, {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=0, must-revalidate',
          },
        });
      }

      return new Response('Not Found', { status: 404 });
    }

    // Determine content type
    const contentType = getContentType(pathname);

    // Determine cache control
    const cacheControl = pathname.includes('/assets/')
      ? 'public, max-age=31536000, immutable' // 1 year for assets
      : 'public, max-age=0, must-revalidate'; // No cache for HTML

    // Handle binary files (base64 encoded)
    const isBinary = isBinaryFile(pathname);
    const responseBody = isBinary
      ? Uint8Array.from(atob(assetContent), c => c.charCodeAt(0))
      : assetContent;

    return new Response(responseBody, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': cacheControl,
      },
    });
  } catch (error) {
    console.error('Static file serving error:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

/**
 * Check if file is binary based on extension
 */
function isBinaryFile(pathname) {
  const ext = pathname.split('.').pop()?.toLowerCase();
  const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'ico', 'woff', 'woff2', 'ttf', 'eot'];
  return binaryExtensions.includes(ext);
}

/**
 * Get content type based on file extension
 */
function getContentType(pathname) {
  const ext = pathname.split('.').pop()?.toLowerCase();
  
  const contentTypes = {
    'html': 'text/html; charset=utf-8',
    'js': 'application/javascript; charset=utf-8',
    'css': 'text/css; charset=utf-8',
    'json': 'application/json; charset=utf-8',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml',
    'ico': 'image/x-icon',
    'woff': 'font/woff',
    'woff2': 'font/woff2',
    'ttf': 'font/ttf',
    'eot': 'application/vnd.ms-fontobject',
  };

  return contentTypes[ext] || 'application/octet-stream';
}
