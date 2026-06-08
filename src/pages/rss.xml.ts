import rss from '@astrojs/rss';
import { sanityClient } from "sanity:client";
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const posts = await sanityClient.fetch(`
    *[_type == "blogPost"] | order(publishedAt desc) {
      title,
      slug,
      excerpt,
      body,
      publishedAt,
      author
    }
  `);

  function toPlainText(blocks: any[] = []) {
    return blocks
      .filter(block => block._type === 'block' && block.children)
      .map(block => block.children.map((child: any) => child.text).join(''))
      .join('\n\n');
  }

  return rss({
    title: 'Quadem Digital Enterprise | Blog',
    description: 'Digital marketing tips, web design insights, and business growth strategies from Quadem Digital Enterprise.',
    site: context.site || 'https://quademdigital.com',
    items: posts.map((post: any) => ({
      title: post.title,
      pubDate: new Date(post.publishedAt || new Date()),
      description: post.excerpt || 'Read the full article on our website.',
      content: toPlainText(post.body),
      link: `/blog/${post.slug.current}/`,
      author: post.author || 'Quadem Digital Team'
    })),
    customData: `<language>en-us</language>`,
  });
};
