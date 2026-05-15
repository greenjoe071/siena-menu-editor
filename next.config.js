/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Tell Next.js to bundle the handoff files with the preview/print functions.
    // Without this, template.html and render.js are invisible to Netlify at runtime.
    outputFileTracingIncludes: {
      '/preview':        ['./handoff/**'],
      '/print':          ['./handoff/**'],
      '/monday-preview':  ['./handoff-monday/**'],
      '/monday-print':    ['./handoff-monday/**'],
      '/weekend-preview': ['./handoff-weekend/**'],
      '/weekend-print':   ['./handoff-weekend/**'],
    },
  },
};

module.exports = nextConfig;
