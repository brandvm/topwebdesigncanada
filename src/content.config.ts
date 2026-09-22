import {defineCollection} from 'astro:content';
import {z} from 'astro/zod';
import {glob} from 'astro/loaders';
export const collections={articles:defineCollection({loader:glob({pattern:'**/*.mdx',base:'./src/content/articles'}),schema:z.object({title:z.string(),seoTitle:z.string().min(10).max(70),seoDescription:z.string().min(80).max(170),slug:z.string().regex(/^[a-z0-9-]+$/),description:z.string(),topic:z.string(),draft:z.boolean().default(false),order:z.number(),sourceYear:z.number(),publishedAt:z.coerce.date().optional(),updatedAt:z.coerce.date().optional(),author:z.string().optional(),image:z.string().optional()})})};
