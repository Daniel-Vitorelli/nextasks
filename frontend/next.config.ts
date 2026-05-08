import {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
 
const nextConfig: NextConfig = {
  images: {
    domains: ['ik.imagekit.io', 'tailark.com'],
  },
};
 
const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);