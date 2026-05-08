import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
 
const nextConfig: NextConfig = {
  images: {
    domains: ['ik.imagekit.io', 'tailark.com'],
  },
  typescript: {
    ignoreBuildErrors: true
  }
};
 
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);