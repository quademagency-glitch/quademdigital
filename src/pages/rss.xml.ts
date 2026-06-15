import rss from '@astrojs/rss';
import { payloadFetch } from "../lib/payload";
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const posts = await payloadFetch('blogPosts', { sort: '-publishedAt' });

  function toPlainText(node: any): string {
    if (!node) return '';
    if (node.root) return node.root.children.map(toPlainText).join('\n\n');
    if (node.type === 'text') return node.text || '';
    if (node.children) return node.children.map(toPlainText).join('');
    return '';
  }

  return rss({
    title: 'Quadem Digital Enterprise | Blog',
    description: 'Digital marketing tips, web design insights, and business growth strategies from Quadem Digital Enterprise.',
    site: context.site || 'https://quademdigital.com',
    items: posts.map((post: any) => {
      const postUrl = `https://quademdigital.com/blog/${post.slug}/`;
      
      // If the user wrote a custom LinkedIn post in Sanity, use it exactly.
      // Otherwise, fallback to a standard title + excerpt + link format.
      const formattedDescription = post.linkedInPost 
        ? post.linkedInPost 
        : `We just published a new article on the blog! 🚀\n\n${post.title}\n\n${post.excerpt}\n\nRead the full guide here: ${postUrl}`;

      return {
        title: post.title,
        pubDate: new Date(post.publishedAt || new Date()),
        description: formattedDescription,
        content: toPlainText(post.body),
        link: postUrl,
        author: post.author || 'Quadem Digital Team'
      };
    }),
    customData: `<language>en-us</language>`,
  });
};
