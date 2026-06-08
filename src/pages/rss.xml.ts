import rss from '@astrojs/rss';
import { sanityClient } from "sanity:client";
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const posts = await sanityClient.fetch(`
    *[_type == "blogPost"] | order(publishedAt desc) {
      title,
      slug,
      excerpt,
      publishedAt,
      author
    }
  `);

  return rss({
    title: 'Quadem Digital Enterprise | Blog',
    description: 'Digital marketing tips, web design insights, and business growth strategies from Quadem Digital Enterprise.',
    site: context.site || 'https://quademdigital.com',
    items: posts.map((post: any) => ({
      title: post.title,
      pubDate: new Date(post.publishedAt || new Date()),
      description: post.excerpt || 'Read the full article on our website.',
      link: `/blog/${post.slug.current}/`,
      author: post.author || 'Quadem Digital Team'
    })),
    customData: `<language>en-us</language>`,
  });
};
