import rss from '@astrojs/rss';
import { sanityClient } from "sanity:client";
import type { APIRoute } from 'astro';

export const GET: APIRoute = async (context) => {
  const posts = await sanityClient.fetch(`
    *[_type == "blogPost"] | order(publishedAt desc) {
      title,
      slug,
      excerpt,
      linkedInPost,
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
    items: posts.map((post: any) => {
      const postUrl = `https://quademdigital.com/blog/${post.slug.current}/`;
      
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
