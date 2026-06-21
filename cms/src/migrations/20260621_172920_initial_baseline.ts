import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en');
  CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor');
  CREATE TYPE "public"."enum_media_kind" AS ENUM('raw', 'mockup');
  CREATE TYPE "public"."enum_leads_source" AS ENUM('contact-form', 'lead-magnet', 'newsletter', 'calculator', 'whatsapp', 'other');
  CREATE TYPE "public"."enum_leads_status" AS ENUM('new', 'contacted', 'qualified', 'won', 'lost', 'archived');
  CREATE TYPE "public"."enum_blog_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__blog_posts_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__blog_posts_v_published_locale" AS ENUM('en');
  CREATE TYPE "public"."enum_services_mockup_status" AS ENUM('pending', 'processing', 'ready', 'failed');
  CREATE TYPE "public"."enum_case_studies_project_type" AS ENUM('client', 'concept', 'self');
  CREATE TYPE "public"."enum_clients_deliverables_category" AS ENUM('design', 'brand', 'documents', 'videos', 'other');
  CREATE TYPE "public"."enum_clients_project_status" AS ENUM('onboarding', 'design', 'development', 'review', 'completed', 'retainer');
  CREATE TYPE "public"."enum_invoices_status" AS ENUM('pending', 'paid', 'overdue');
  CREATE TYPE "public"."enum_pages_blocks_hero_section_buttons_style" AS ENUM('primary', 'secondary', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_image_gallery_layout" AS ENUM('grid', 'masonry', 'carousel');
  CREATE TYPE "public"."enum_pages_blocks_call_to_action_buttons_style" AS ENUM('primary', 'secondary', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_media_and_text_buttons_style" AS ENUM('primary', 'secondary', 'outline');
  CREATE TYPE "public"."enum_pages_blocks_media_and_text_media_alignment" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum_pages_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_blocks_hero_section_buttons_style" AS ENUM('primary', 'secondary', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_image_gallery_layout" AS ENUM('grid', 'masonry', 'carousel');
  CREATE TYPE "public"."enum__pages_v_blocks_call_to_action_buttons_style" AS ENUM('primary', 'secondary', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_media_and_text_buttons_style" AS ENUM('primary', 'secondary', 'outline');
  CREATE TYPE "public"."enum__pages_v_blocks_media_and_text_media_alignment" AS ENUM('left', 'right');
  CREATE TYPE "public"."enum__pages_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__pages_v_published_locale" AS ENUM('en');
  CREATE TYPE "public"."enum_email_campaigns_status" AS ENUM('draft', 'sent');
  CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('linkedin', 'instagram', 'twitter', 'facebook', 'youtube', 'tiktok', 'github', 'behance', 'dribbble', 'threads', 'pinterest', 'snapchat', 'other');
  CREATE TYPE "public"."enum_homepage_hero_services_mockup_status" AS ENUM('pending', 'processing', 'ready', 'failed');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"role" "enum_users_role" DEFAULT 'admin' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"kind" "enum_media_kind" DEFAULT 'raw',
  	"source_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "folders" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "leads" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"source" "enum_leads_source",
  	"magnet_requested" varchar,
  	"name" varchar NOT NULL,
  	"email" varchar NOT NULL,
  	"message" varchar,
  	"metadata" jsonb,
  	"status" "enum_leads_status" DEFAULT 'new',
  	"submitted_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "blog_categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "blog_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"excerpt" varchar,
  	"linked_in_post" varchar,
  	"cover_image_id" integer,
  	"category_id" integer,
  	"body" jsonb,
  	"published_at" timestamp(3) with time zone,
  	"author" varchar DEFAULT 'Quadem Digital',
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_blog_posts_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_blog_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_excerpt" varchar,
  	"version_linked_in_post" varchar,
  	"version_cover_image_id" integer,
  	"version_category_id" integer,
  	"version_body" jsonb,
  	"version_published_at" timestamp(3) with time zone,
  	"version_author" varchar DEFAULT 'Quadem Digital',
  	"version_seo_description" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__blog_posts_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__blog_posts_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "services_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar,
  	"icon_svg" varchar,
  	"body" jsonb,
  	"order" numeric,
  	"raw_media_id" integer,
  	"mockup_media_id" integer,
  	"mockup_status" "enum_services_mockup_status" DEFAULT 'pending',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "case_studies_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "case_studies_video_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"video_url" varchar,
  	"video_file_id" integer
  );
  
  CREATE TABLE "case_studies" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"tag" varchar,
  	"description" varchar,
  	"result_metric" varchar,
  	"result_text" varchar,
  	"cover_image_id" integer,
  	"body" jsonb,
  	"order" numeric,
  	"project_type" "enum_case_studies_project_type" DEFAULT 'concept',
  	"published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "offers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"description" varchar NOT NULL,
  	"image_id" integer,
  	"cta" varchar DEFAULT 'Claim Offer',
  	"published_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "testimonials" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"author_name" varchar,
  	"author_role" varchar,
  	"quote" varchar,
  	"stars" numeric,
  	"avatar_id" integer,
  	"video_url" varchar,
  	"video_file_id" integer,
  	"order" numeric,
  	"published" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "faqs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "webapps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"tagline" varchar,
  	"description" varchar,
  	"status" varchar,
  	"link" varchar,
  	"order" numeric,
  	"logo_id" integer,
  	"cover_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stats" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL,
  	"label" varchar NOT NULL,
  	"prefix" varchar,
  	"suffix" varchar,
  	"order" numeric,
  	"published" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "process_steps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"step_number" numeric NOT NULL,
  	"icon_svg" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pricing_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "pricing_plans" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"price_u_s_d" numeric,
  	"price_g_h_s" numeric,
  	"price_label" varchar,
  	"billing_cycle" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false,
  	"button_text" varchar,
  	"order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "calculator_services" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"base_price" numeric NOT NULL,
  	"price_u_s_d" numeric,
  	"price_g_h_s" numeric,
  	"billing_cycle" varchar,
  	"description" varchar,
  	"order" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clients_timeline" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar
  );
  
  CREATE TABLE "clients_deliverables" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"category" "enum_clients_deliverables_category" DEFAULT 'other',
  	"title" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "clients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"access_code" varchar NOT NULL,
  	"project_name" varchar,
  	"project_status" "enum_clients_project_status" DEFAULT 'onboarding',
  	"welcome_message" varchar,
  	"onboarding_guide_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "invoices_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"quantity" numeric DEFAULT 1 NOT NULL,
  	"rate" numeric NOT NULL
  );
  
  CREATE TABLE "invoices" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"invoice_id" varchar NOT NULL,
  	"client_id" integer NOT NULL,
  	"date_issued" timestamp(3) with time zone,
  	"due_date" timestamp(3) with time zone,
  	"status" "enum_invoices_status" DEFAULT 'pending',
  	"currency" varchar DEFAULT 'USD',
  	"tax_rate" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "onboarding_guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"description" varchar,
  	"content" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "pages_blocks_hero_section_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"style" "enum_pages_blocks_hero_section_buttons_style" DEFAULT 'primary'
  );
  
  CREATE TABLE "pages_blocks_hero_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"background_image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_text_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"content" jsonb,
  	"content_html" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "pages_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"layout" "enum_pages_blocks_image_gallery_layout" DEFAULT 'grid',
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_call_to_action_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"style" "enum_pages_blocks_call_to_action_buttons_style" DEFAULT 'primary'
  );
  
  CREATE TABLE "pages_blocks_call_to_action" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon_id" integer,
  	"title" varchar,
  	"description" varchar,
  	"link" varchar
  );
  
  CREATE TABLE "pages_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_testimonial_slider_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"author_name" varchar,
  	"author_role" varchar,
  	"author_image_id" integer,
  	"company_logo_id" integer
  );
  
  CREATE TABLE "pages_blocks_testimonial_slider" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_accordion_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar
  );
  
  CREATE TABLE "pages_blocks_faq_accordion" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_video_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"video_url" varchar,
  	"caption" varchar,
  	"thumbnail_image_id" integer,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_pricing_cards_cards_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "pages_blocks_pricing_cards_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tier_name" varchar,
  	"price" varchar,
  	"billing_period" varchar,
  	"description" varchar,
  	"button_label" varchar,
  	"button_url" varchar,
  	"is_popular" boolean
  );
  
  CREATE TABLE "pages_blocks_pricing_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_team_grid_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"name" varchar,
  	"role" varchar,
  	"bio" varchar,
  	"linkedin_url" varchar,
  	"twitter_url" varchar
  );
  
  CREATE TABLE "pages_blocks_team_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_logo_cloud_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"logo_id" integer,
  	"company_name" varchar
  );
  
  CREATE TABLE "pages_blocks_logo_cloud" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages_blocks_media_and_text_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"style" "enum_pages_blocks_media_and_text_buttons_style" DEFAULT 'primary'
  );
  
  CREATE TABLE "pages_blocks_media_and_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"media_alignment" "enum_pages_blocks_media_and_text_media_alignment" DEFAULT 'left',
  	"media_id" integer,
  	"heading" varchar,
  	"content" jsonb,
  	"content_html" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "pages" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_pages_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "_pages_v_blocks_hero_section_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"style" "enum__pages_v_blocks_hero_section_buttons_style" DEFAULT 'primary',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_hero_section" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"background_image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_text_block" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"content" jsonb,
  	"content_html" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_image_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"layout" "enum__pages_v_blocks_image_gallery_layout" DEFAULT 'grid',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_call_to_action_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"style" "enum__pages_v_blocks_call_to_action_buttons_style" DEFAULT 'primary',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_call_to_action" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"text" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"icon_id" integer,
  	"title" varchar,
  	"description" varchar,
  	"link" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_feature_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_testimonial_slider_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"quote" varchar,
  	"author_name" varchar,
  	"author_role" varchar,
  	"author_image_id" integer,
  	"company_logo_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_testimonial_slider" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_accordion_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"question" varchar,
  	"answer" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_faq_accordion" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_video_embed" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"video_url" varchar,
  	"caption" varchar,
  	"thumbnail_image_id" integer,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_pricing_cards_cards_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"feature" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_pricing_cards_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tier_name" varchar,
  	"price" varchar,
  	"billing_period" varchar,
  	"description" varchar,
  	"button_label" varchar,
  	"button_url" varchar,
  	"is_popular" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_pricing_cards" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_team_grid_members" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"name" varchar,
  	"role" varchar,
  	"bio" varchar,
  	"linkedin_url" varchar,
  	"twitter_url" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_team_grid" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"subheading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_logo_cloud_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_id" integer,
  	"company_name" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_logo_cloud" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_media_and_text_buttons" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar,
  	"style" "enum__pages_v_blocks_media_and_text_buttons_style" DEFAULT 'primary',
  	"_uuid" varchar
  );
  
  CREATE TABLE "_pages_v_blocks_media_and_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"media_alignment" "enum__pages_v_blocks_media_and_text_media_alignment" DEFAULT 'left',
  	"media_id" integer,
  	"heading" varchar,
  	"content" jsonb,
  	"content_html" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_pages_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_title" varchar,
  	"version_slug" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__pages_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__pages_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "email_campaigns" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"subject" varchar NOT NULL,
  	"preview_text" varchar,
  	"body" jsonb,
  	"body_html" varchar,
  	"cta_text" varchar,
  	"cta_url" varchar,
  	"status" "enum_email_campaigns_status" DEFAULT 'draft',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"folders_id" integer,
  	"tags_id" integer,
  	"leads_id" integer,
  	"blog_categories_id" integer,
  	"blog_posts_id" integer,
  	"services_id" integer,
  	"case_studies_id" integer,
  	"offers_id" integer,
  	"testimonials_id" integer,
  	"faqs_id" integer,
  	"webapps_id" integer,
  	"stats_id" integer,
  	"process_steps_id" integer,
  	"pricing_plans_id" integer,
  	"calculator_services_id" integer,
  	"clients_id" integer,
  	"invoices_id" integer,
  	"onboarding_guides_id" integer,
  	"pages_id" integer,
  	"email_campaigns_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_site_settings_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "site_settings_client_logos" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"logo_id" integer
  );
  
  CREATE TABLE "site_settings_nav_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"url" varchar
  );
  
  CREATE TABLE "site_settings_footer_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "site_settings_certifications" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge_id" integer NOT NULL,
  	"label" varchar NOT NULL,
  	"verify_link" varchar
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"email" varchar,
  	"whatsapp_number" varchar,
  	"whatsapp_message" varchar DEFAULT 'Hi, I''d like to discuss a project with Quadem Digital.',
  	"footer_tagline" varchar,
  	"bank_details_bank_name" varchar,
  	"bank_details_account_name" varchar,
  	"bank_details_account_number" varchar,
  	"enable_paystack" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "homepage_hero_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"prefix" varchar,
  	"service" varchar,
  	"suffix" varchar,
  	"raw_media_id" integer,
  	"mockup_media_id" integer,
  	"mockup_status" "enum_homepage_hero_services_mockup_status" DEFAULT 'pending'
  );
  
  CREATE TABLE "homepage_trust_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"icon" varchar,
  	"title" varchar NOT NULL,
  	"description" varchar NOT NULL
  );
  
  CREATE TABLE "homepage_founder_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"paragraph" varchar
  );
  
  CREATE TABLE "homepage" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_headline" varchar,
  	"hero_tagline" varchar,
  	"hero_subheadline" varchar,
  	"primary_cta_label" varchar DEFAULT 'Get a Free Audit',
  	"primary_cta_link" varchar DEFAULT '#contact',
  	"secondary_cta_label" varchar DEFAULT 'View Our Work',
  	"secondary_cta_link" varchar DEFAULT '#work',
  	"show_stats" boolean DEFAULT false,
  	"risk_reversal_enabled" boolean DEFAULT true,
  	"risk_reversal_heading" varchar DEFAULT 'New agency. No risk to you.',
  	"risk_reversal_body" varchar DEFAULT 'We''re early, and we know trust is earned. That''s why we back every engagement with a clear scope, weekly updates, and a satisfaction guarantee — if we don''t deliver what we promised, you don''t pay.',
  	"founder_title" varchar,
  	"founder_image_id" integer,
  	"newsletter_heading" varchar,
  	"newsletter_subheading" varchar,
  	"contact_heading" varchar DEFAULT 'Let''s build something great',
  	"contact_subheading" varchar DEFAULT 'Fill out the form below or chat directly with us on WhatsApp to get started.',
  	"contact_info_title" varchar DEFAULT 'Get in Touch',
  	"contact_info_text" varchar DEFAULT 'We''re ready to help you scale your business. Reach out today and let''s start the conversation.',
  	"contact_whatsapp_button_text" varchar DEFAULT 'Chat on WhatsApp',
  	"contact_submit_button_text" varchar DEFAULT 'Send Message',
  	"contact_form_success_message" varchar DEFAULT 'Thanks for reaching out! We''ll be in touch shortly.',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_core_values" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar DEFAULT 'About Me',
  	"founder_name" varchar,
  	"headline" varchar,
  	"subheadline" varchar,
  	"bio" varchar,
  	"mission" varchar,
  	"vision" varchar,
  	"founder_image_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "contact_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "services_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "projects_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"heading" varchar,
  	"subheading" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "quaderp_page_trust_badges" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"badge" varchar
  );
  
  CREATE TABLE "quaderp_page_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon" varchar
  );
  
  CREATE TABLE "quaderp_page_showcase_items_bullet_points" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"point" varchar
  );
  
  CREATE TABLE "quaderp_page_showcase_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"heading" varchar,
  	"heading_gradient" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "quaderp_page_pricing_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "quaderp_page_pricing_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"price" varchar,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean,
  	"button_text" varchar
  );
  
  CREATE TABLE "quaderp_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🚀 Introducing QuadERP',
  	"hero_title" varchar DEFAULT 'Take Control of Your',
  	"hero_title_gradient" varchar DEFAULT 'Store Operations',
  	"hero_subtitle" varchar DEFAULT 'Real-time sales tracking, smart inventory management, staff oversight, and theft prevention — all in one powerful platform built for modern retail.',
  	"features_heading" varchar DEFAULT 'Everything You Need to Run Your Store',
  	"features_subtitle" varchar DEFAULT 'Powerful tools designed for retail businesses of every size — from single shops to multi-location chains.',
  	"showcase_heading" varchar DEFAULT 'See QuadERP in Action',
  	"pricing_heading" varchar DEFAULT 'Simple, Transparent Pricing',
  	"pricing_subtitle" varchar DEFAULT 'Start free. Scale as you grow. No hidden fees, ever.',
  	"pricing_note" varchar DEFAULT '🔒 All plans include a 14-day free trial. Prices are placeholder and subject to change.',
  	"contact_heading" varchar DEFAULT 'Get Started With QuadERP',
  	"contact_subtitle" varchar DEFAULT 'Tell us about your business and we''ll set you up with the perfect plan.',
  	"formspree_endpoint" varchar DEFAULT 'https://formspree.io/f/xgobwrdw',
  	"calendly_url" varchar DEFAULT 'https://calendly.com/quademdigitalenterprise/quaderp-demo-call',
  	"whatsapp_number" varchar DEFAULT '233530890302',
  	"whatsapp_message" varchar DEFAULT 'Hi Quadem! I''m interested in QuadERP for my store. Can we talk?',
  	"seo_title" varchar,
  	"seo_description" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "video_production_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );
  
  CREATE TABLE "video_production_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "video_production_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "video_production_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );
  
  CREATE TABLE "video_production_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "video_production_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🎬 Video Production',
  	"hero_headline" varchar DEFAULT 'Professional Video Production',
  	"hero_subtitle" varchar DEFAULT 'From concept to final cut — we produce high-quality video content that captures attention, tells your story, and drives results for your brand.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free Quote',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing ↓',
  	"services_section_heading" varchar DEFAULT 'What We Produce',
  	"services_section_subtitle" varchar DEFAULT 'From polished corporate content to high-energy social media videos, we cover it all.',
  	"showreel_heading" varchar DEFAULT 'Our Showreel',
  	"showreel_subtitle" varchar DEFAULT 'A taste of our recent work — from concept to final delivery.',
  	"showreel_video_url" varchar,
  	"showreel_is_coming_soon" boolean DEFAULT true,
  	"process_section_heading" varchar DEFAULT 'Our Production Process',
  	"process_section_subtitle" varchar DEFAULT 'A streamlined workflow that takes your project from idea to screen.',
  	"pricing_section_heading" varchar DEFAULT 'Video Production Pricing',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent pricing designed for businesses at every stage. All prices are starting points — we tailor every project to your needs.',
  	"pricing_section_note" varchar DEFAULT '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.',
  	"faq_section_heading" varchar DEFAULT 'Frequently Asked Questions',
  	"faq_section_subtitle" varchar DEFAULT 'Everything you need to know about our video production services.',
  	"cta_section_heading" varchar DEFAULT 'Ready to bring your vision to life?',
  	"cta_section_subtitle" varchar DEFAULT 'Book a free video consultation and let''s discuss your next project. No commitments — just a conversation about your goals.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Book a Free Consultation',
  	"cta_section_whatsapp_button_text" varchar DEFAULT '💬 Chat on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "web_design_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );
  
  CREATE TABLE "web_design_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "web_design_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "web_design_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );
  
  CREATE TABLE "web_design_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "web_design_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🖥️ Web Design',
  	"hero_headline" varchar DEFAULT 'Professional Web Design',
  	"hero_subtitle" varchar DEFAULT 'Custom, responsive websites built to convert visitors into loyal customers and grow your business.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free Quote',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing ↓',
  	"services_section_heading" varchar DEFAULT 'Web Design Services',
  	"services_section_subtitle" varchar DEFAULT 'From custom websites to e‑commerce platforms, we craft digital experiences that work.',
  	"showreel_heading" varchar DEFAULT 'Our Showreel',
  	"showreel_subtitle" varchar DEFAULT 'A taste of our web design projects — from concept to launch.',
  	"showreel_video_url" varchar,
  	"showreel_is_coming_soon" boolean DEFAULT true,
  	"process_section_heading" varchar DEFAULT 'Our Design Process',
  	"process_section_subtitle" varchar DEFAULT 'A streamlined workflow that takes your project from idea to launch.',
  	"pricing_section_heading" varchar DEFAULT 'Web Design Pricing',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent pricing for websites of any scale.',
  	"pricing_section_note" varchar DEFAULT '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.',
  	"faq_section_heading" varchar DEFAULT 'Web Design FAQs',
  	"faq_section_subtitle" varchar DEFAULT 'Common questions about our web design services.',
  	"cta_section_heading" varchar DEFAULT 'Ready to launch your website?',
  	"cta_section_subtitle" varchar DEFAULT 'Book a free web design consultation and let''s discuss your project. No commitments — just a conversation about your goals.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Book a Free Consultation',
  	"cta_section_whatsapp_button_text" varchar DEFAULT '💬 Chat on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "brand_identity_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );
  
  CREATE TABLE "brand_identity_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "brand_identity_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "brand_identity_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );
  
  CREATE TABLE "brand_identity_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "brand_identity_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '🎨 Brand Identity',
  	"hero_headline" varchar DEFAULT 'Professional Brand & Graphic Design',
  	"hero_subtitle" varchar DEFAULT 'Distinct visual identities that make your brand memorable and professional.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free Quote',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing ↓',
  	"services_section_heading" varchar DEFAULT 'Brand Design Services',
  	"services_section_subtitle" varchar DEFAULT 'Logo design, brand kits, visual identity systems, and more.',
  	"showreel_heading" varchar DEFAULT 'Our Portfolio Showcase',
  	"showreel_subtitle" varchar DEFAULT 'A glimpse of our branding projects — from concept to delivery.',
  	"showreel_video_url" varchar,
  	"showreel_is_coming_soon" boolean DEFAULT true,
  	"process_section_heading" varchar DEFAULT 'Our Design Process',
  	"process_section_subtitle" varchar DEFAULT 'A streamlined workflow that takes your project from idea to launch.',
  	"pricing_section_heading" varchar DEFAULT 'Brand Identity Pricing',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent pricing for brand design projects of any scale.',
  	"pricing_section_note" varchar DEFAULT '* Prices are starting points. Final pricing is determined by project scope, complexity, and timeline.',
  	"faq_section_heading" varchar DEFAULT 'Brand Design FAQs',
  	"faq_section_subtitle" varchar DEFAULT 'Common questions about our branding services.',
  	"cta_section_heading" varchar DEFAULT 'Ready to build a memorable brand?',
  	"cta_section_subtitle" varchar DEFAULT 'Book a free branding consultation and let''s discuss your visual identity. No commitments — just a conversation about your goals.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Book a Free Consultation',
  	"cta_section_whatsapp_button_text" varchar DEFAULT '💬 Chat on WhatsApp',
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "seo_page_services_section_services_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "seo_page_services_section_services" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"description" varchar,
  	"icon_svg" varchar
  );
  
  CREATE TABLE "seo_page_process_section_steps" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"number" varchar,
  	"title" varchar,
  	"description" varchar
  );
  
  CREATE TABLE "seo_page_pricing_section_plans_features" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"feature" varchar
  );
  
  CREATE TABLE "seo_page_pricing_section_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"price" varchar NOT NULL,
  	"period" varchar,
  	"description" varchar,
  	"is_popular" boolean DEFAULT false
  );
  
  CREATE TABLE "seo_page_faq_section_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL
  );
  
  CREATE TABLE "seo_page" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"hero_badge" varchar DEFAULT '📈 SEO & Content Marketing',
  	"hero_headline" varchar DEFAULT 'Be Found When They Search',
  	"hero_subtitle" varchar DEFAULT 'We don''t just chase vanity metrics. We build data-driven SEO and content strategies that increase your visibility, drive qualified traffic, and generate real revenue.',
  	"hero_primary_cta_text" varchar DEFAULT 'Get a Free SEO Audit',
  	"hero_secondary_cta_text" varchar DEFAULT 'View Pricing',
  	"services_section_heading" varchar DEFAULT 'Our SEO Arsenal',
  	"services_section_subtitle" varchar DEFAULT 'Comprehensive search marketing to dominate every stage of the funnel.',
  	"process_section_heading" varchar DEFAULT 'The Ranking Process',
  	"process_section_subtitle" varchar DEFAULT 'How we take your site from obscurity to the top of the SERPs.',
  	"pricing_section_heading" varchar DEFAULT 'SEO Retainers',
  	"pricing_section_subtitle" varchar DEFAULT 'Transparent monthly pricing. No long-term lock-ins. Proven results.',
  	"pricing_section_note" varchar,
  	"faq_section_heading" varchar DEFAULT 'SEO FAQs',
  	"faq_section_subtitle" varchar DEFAULT 'Everything you need to know about our SEO process.',
  	"cta_section_heading" varchar DEFAULT 'Stop Losing Traffic to Competitors',
  	"cta_section_subtitle" varchar DEFAULT 'Let''s run a comprehensive audit on your website and discover exactly what it takes to get you to page one.',
  	"cta_section_primary_button_text" varchar DEFAULT 'Request Your Free Audit',
  	"cta_section_whatsapp_button_text" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_source_image_id_media_id_fk" FOREIGN KEY ("source_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_category_id_blog_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_parent_id_blog_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."blog_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_blog_posts_v" ADD CONSTRAINT "_blog_posts_v_version_category_id_blog_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."blog_categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services_tags" ADD CONSTRAINT "services_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_raw_media_id_media_id_fk" FOREIGN KEY ("raw_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "services" ADD CONSTRAINT "services_mockup_media_id_media_id_fk" FOREIGN KEY ("mockup_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_studies_image_gallery" ADD CONSTRAINT "case_studies_image_gallery_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_studies_image_gallery" ADD CONSTRAINT "case_studies_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_studies_video_gallery" ADD CONSTRAINT "case_studies_video_gallery_video_file_id_media_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "case_studies_video_gallery" ADD CONSTRAINT "case_studies_video_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "case_studies" ADD CONSTRAINT "case_studies_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "offers" ADD CONSTRAINT "offers_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_avatar_id_media_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "testimonials" ADD CONSTRAINT "testimonials_video_file_id_media_id_fk" FOREIGN KEY ("video_file_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "webapps" ADD CONSTRAINT "webapps_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "webapps" ADD CONSTRAINT "webapps_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pricing_plans_features" ADD CONSTRAINT "pricing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients_timeline" ADD CONSTRAINT "clients_timeline_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients_deliverables" ADD CONSTRAINT "clients_deliverables_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "clients" ADD CONSTRAINT "clients_onboarding_guide_id_onboarding_guides_id_fk" FOREIGN KEY ("onboarding_guide_id") REFERENCES "public"."onboarding_guides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "invoices_items" ADD CONSTRAINT "invoices_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_client_id_clients_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_section_buttons" ADD CONSTRAINT "pages_blocks_hero_section_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_hero_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_section" ADD CONSTRAINT "pages_blocks_hero_section_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_hero_section" ADD CONSTRAINT "pages_blocks_hero_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_text_block" ADD CONSTRAINT "pages_blocks_text_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_images" ADD CONSTRAINT "pages_blocks_image_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery_images" ADD CONSTRAINT "pages_blocks_image_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_image_gallery" ADD CONSTRAINT "pages_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_call_to_action_buttons" ADD CONSTRAINT "pages_blocks_call_to_action_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_call_to_action"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_call_to_action" ADD CONSTRAINT "pages_blocks_call_to_action_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_features" ADD CONSTRAINT "pages_blocks_feature_grid_features_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid_features" ADD CONSTRAINT "pages_blocks_feature_grid_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_feature_grid" ADD CONSTRAINT "pages_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial_slider_testimonials" ADD CONSTRAINT "pages_blocks_testimonial_slider_testimonials_author_image_id_media_id_fk" FOREIGN KEY ("author_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial_slider_testimonials" ADD CONSTRAINT "pages_blocks_testimonial_slider_testimonials_company_logo_id_media_id_fk" FOREIGN KEY ("company_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial_slider_testimonials" ADD CONSTRAINT "pages_blocks_testimonial_slider_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_testimonial_slider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_testimonial_slider" ADD CONSTRAINT "pages_blocks_testimonial_slider_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_accordion_faqs" ADD CONSTRAINT "pages_blocks_faq_accordion_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_faq_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_faq_accordion" ADD CONSTRAINT "pages_blocks_faq_accordion_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_video_embed" ADD CONSTRAINT "pages_blocks_video_embed_thumbnail_image_id_media_id_fk" FOREIGN KEY ("thumbnail_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_video_embed" ADD CONSTRAINT "pages_blocks_video_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_cards_cards_features" ADD CONSTRAINT "pages_blocks_pricing_cards_cards_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing_cards_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_cards_cards" ADD CONSTRAINT "pages_blocks_pricing_cards_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_pricing_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_pricing_cards" ADD CONSTRAINT "pages_blocks_pricing_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_team_grid_members" ADD CONSTRAINT "pages_blocks_team_grid_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_team_grid_members" ADD CONSTRAINT "pages_blocks_team_grid_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_team_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_team_grid" ADD CONSTRAINT "pages_blocks_team_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_cloud_logos" ADD CONSTRAINT "pages_blocks_logo_cloud_logos_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_cloud_logos" ADD CONSTRAINT "pages_blocks_logo_cloud_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_logo_cloud"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_logo_cloud" ADD CONSTRAINT "pages_blocks_logo_cloud_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_and_text_buttons" ADD CONSTRAINT "pages_blocks_media_and_text_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages_blocks_media_and_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_and_text" ADD CONSTRAINT "pages_blocks_media_and_text_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages_blocks_media_and_text" ADD CONSTRAINT "pages_blocks_media_and_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_section_buttons" ADD CONSTRAINT "_pages_v_blocks_hero_section_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_hero_section"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_section" ADD CONSTRAINT "_pages_v_blocks_hero_section_background_image_id_media_id_fk" FOREIGN KEY ("background_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_hero_section" ADD CONSTRAINT "_pages_v_blocks_hero_section_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_text_block" ADD CONSTRAINT "_pages_v_blocks_text_block_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery_images" ADD CONSTRAINT "_pages_v_blocks_image_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery_images" ADD CONSTRAINT "_pages_v_blocks_image_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_image_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_image_gallery" ADD CONSTRAINT "_pages_v_blocks_image_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_call_to_action_buttons" ADD CONSTRAINT "_pages_v_blocks_call_to_action_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_call_to_action"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_call_to_action" ADD CONSTRAINT "_pages_v_blocks_call_to_action_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_features" ADD CONSTRAINT "_pages_v_blocks_feature_grid_features_icon_id_media_id_fk" FOREIGN KEY ("icon_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid_features" ADD CONSTRAINT "_pages_v_blocks_feature_grid_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_feature_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_feature_grid" ADD CONSTRAINT "_pages_v_blocks_feature_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_testimonial_slider_testimonials" ADD CONSTRAINT "_pages_v_blocks_testimonial_slider_testimonials_author_image_id_media_id_fk" FOREIGN KEY ("author_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_testimonial_slider_testimonials" ADD CONSTRAINT "_pages_v_blocks_testimonial_slider_testimonials_company_logo_id_media_id_fk" FOREIGN KEY ("company_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_testimonial_slider_testimonials" ADD CONSTRAINT "_pages_v_blocks_testimonial_slider_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_testimonial_slider"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_testimonial_slider" ADD CONSTRAINT "_pages_v_blocks_testimonial_slider_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_accordion_faqs" ADD CONSTRAINT "_pages_v_blocks_faq_accordion_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_faq_accordion"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_faq_accordion" ADD CONSTRAINT "_pages_v_blocks_faq_accordion_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_video_embed" ADD CONSTRAINT "_pages_v_blocks_video_embed_thumbnail_image_id_media_id_fk" FOREIGN KEY ("thumbnail_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_video_embed" ADD CONSTRAINT "_pages_v_blocks_video_embed_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_pricing_cards_cards_features" ADD CONSTRAINT "_pages_v_blocks_pricing_cards_cards_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_pricing_cards_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_pricing_cards_cards" ADD CONSTRAINT "_pages_v_blocks_pricing_cards_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_pricing_cards"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_pricing_cards" ADD CONSTRAINT "_pages_v_blocks_pricing_cards_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_team_grid_members" ADD CONSTRAINT "_pages_v_blocks_team_grid_members_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_team_grid_members" ADD CONSTRAINT "_pages_v_blocks_team_grid_members_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_team_grid"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_team_grid" ADD CONSTRAINT "_pages_v_blocks_team_grid_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_logo_cloud_logos" ADD CONSTRAINT "_pages_v_blocks_logo_cloud_logos_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_logo_cloud_logos" ADD CONSTRAINT "_pages_v_blocks_logo_cloud_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_logo_cloud"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_logo_cloud" ADD CONSTRAINT "_pages_v_blocks_logo_cloud_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_and_text_buttons" ADD CONSTRAINT "_pages_v_blocks_media_and_text_buttons_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v_blocks_media_and_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_and_text" ADD CONSTRAINT "_pages_v_blocks_media_and_text_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_pages_v_blocks_media_and_text" ADD CONSTRAINT "_pages_v_blocks_media_and_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_pages_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_pages_v" ADD CONSTRAINT "_pages_v_parent_id_pages_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."pages"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_folders_fk" FOREIGN KEY ("folders_id") REFERENCES "public"."folders"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_leads_fk" FOREIGN KEY ("leads_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_categories_fk" FOREIGN KEY ("blog_categories_id") REFERENCES "public"."blog_categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_blog_posts_fk" FOREIGN KEY ("blog_posts_id") REFERENCES "public"."blog_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_services_fk" FOREIGN KEY ("services_id") REFERENCES "public"."services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_case_studies_fk" FOREIGN KEY ("case_studies_id") REFERENCES "public"."case_studies"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_offers_fk" FOREIGN KEY ("offers_id") REFERENCES "public"."offers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_testimonials_fk" FOREIGN KEY ("testimonials_id") REFERENCES "public"."testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_faqs_fk" FOREIGN KEY ("faqs_id") REFERENCES "public"."faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_webapps_fk" FOREIGN KEY ("webapps_id") REFERENCES "public"."webapps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stats_fk" FOREIGN KEY ("stats_id") REFERENCES "public"."stats"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_process_steps_fk" FOREIGN KEY ("process_steps_id") REFERENCES "public"."process_steps"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pricing_plans_fk" FOREIGN KEY ("pricing_plans_id") REFERENCES "public"."pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_calculator_services_fk" FOREIGN KEY ("calculator_services_id") REFERENCES "public"."calculator_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clients_fk" FOREIGN KEY ("clients_id") REFERENCES "public"."clients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invoices_fk" FOREIGN KEY ("invoices_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_onboarding_guides_fk" FOREIGN KEY ("onboarding_guides_id") REFERENCES "public"."onboarding_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_pages_fk" FOREIGN KEY ("pages_id") REFERENCES "public"."pages"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_email_campaigns_fk" FOREIGN KEY ("email_campaigns_id") REFERENCES "public"."email_campaigns"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_client_logos" ADD CONSTRAINT "site_settings_client_logos_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_client_logos" ADD CONSTRAINT "site_settings_client_logos_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_nav_links" ADD CONSTRAINT "site_settings_nav_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_footer_links" ADD CONSTRAINT "site_settings_footer_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_certifications" ADD CONSTRAINT "site_settings_certifications_badge_id_media_id_fk" FOREIGN KEY ("badge_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_certifications" ADD CONSTRAINT "site_settings_certifications_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_hero_services" ADD CONSTRAINT "homepage_hero_services_raw_media_id_media_id_fk" FOREIGN KEY ("raw_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_hero_services" ADD CONSTRAINT "homepage_hero_services_mockup_media_id_media_id_fk" FOREIGN KEY ("mockup_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "homepage_hero_services" ADD CONSTRAINT "homepage_hero_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_trust_highlights" ADD CONSTRAINT "homepage_trust_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage_founder_text" ADD CONSTRAINT "homepage_founder_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."homepage"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "homepage" ADD CONSTRAINT "homepage_founder_image_id_media_id_fk" FOREIGN KEY ("founder_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_core_values" ADD CONSTRAINT "about_core_values_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "about" ADD CONSTRAINT "about_founder_image_id_media_id_fk" FOREIGN KEY ("founder_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "quaderp_page_trust_badges" ADD CONSTRAINT "quaderp_page_trust_badges_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_features" ADD CONSTRAINT "quaderp_page_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_showcase_items_bullet_points" ADD CONSTRAINT "quaderp_page_showcase_items_bullet_points_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page_showcase_items"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_showcase_items" ADD CONSTRAINT "quaderp_page_showcase_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_pricing_plans_features" ADD CONSTRAINT "quaderp_page_pricing_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page_pricing_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "quaderp_page_pricing_plans" ADD CONSTRAINT "quaderp_page_pricing_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."quaderp_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "video_production_page_services_section_services" ADD CONSTRAINT "video_production_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "video_production_page_process_section_steps" ADD CONSTRAINT "video_production_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "video_production_page_pricing_section_plans_features" ADD CONSTRAINT "video_production_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "video_production_page_pricing_section_plans" ADD CONSTRAINT "video_production_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "video_production_page_faq_section_faqs" ADD CONSTRAINT "video_production_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."video_production_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_design_page_services_section_services" ADD CONSTRAINT "web_design_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_design_page_process_section_steps" ADD CONSTRAINT "web_design_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_design_page_pricing_section_plans_features" ADD CONSTRAINT "web_design_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_design_page_pricing_section_plans" ADD CONSTRAINT "web_design_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "web_design_page_faq_section_faqs" ADD CONSTRAINT "web_design_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."web_design_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_identity_page_services_section_services" ADD CONSTRAINT "brand_identity_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_identity_page_process_section_steps" ADD CONSTRAINT "brand_identity_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_identity_page_pricing_section_plans_features" ADD CONSTRAINT "brand_identity_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_identity_page_pricing_section_plans" ADD CONSTRAINT "brand_identity_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "brand_identity_page_faq_section_faqs" ADD CONSTRAINT "brand_identity_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."brand_identity_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_page_services_section_services_features" ADD CONSTRAINT "seo_page_services_section_services_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page_services_section_services"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_page_services_section_services" ADD CONSTRAINT "seo_page_services_section_services_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_page_process_section_steps" ADD CONSTRAINT "seo_page_process_section_steps_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_page_pricing_section_plans_features" ADD CONSTRAINT "seo_page_pricing_section_plans_features_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page_pricing_section_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_page_pricing_section_plans" ADD CONSTRAINT "seo_page_pricing_section_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "seo_page_faq_section_faqs" ADD CONSTRAINT "seo_page_faq_section_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."seo_page"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_source_image_idx" ON "media" USING btree ("source_image_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "folders_updated_at_idx" ON "folders" USING btree ("updated_at");
  CREATE INDEX "folders_created_at_idx" ON "folders" USING btree ("created_at");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE INDEX "leads_updated_at_idx" ON "leads" USING btree ("updated_at");
  CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");
  CREATE UNIQUE INDEX "blog_categories_slug_idx" ON "blog_categories" USING btree ("slug");
  CREATE INDEX "blog_categories_updated_at_idx" ON "blog_categories" USING btree ("updated_at");
  CREATE INDEX "blog_categories_created_at_idx" ON "blog_categories" USING btree ("created_at");
  CREATE UNIQUE INDEX "blog_posts_slug_idx" ON "blog_posts" USING btree ("slug");
  CREATE INDEX "blog_posts_cover_image_idx" ON "blog_posts" USING btree ("cover_image_id");
  CREATE INDEX "blog_posts_category_idx" ON "blog_posts" USING btree ("category_id");
  CREATE INDEX "blog_posts_published_at_idx" ON "blog_posts" USING btree ("published_at");
  CREATE INDEX "blog_posts_updated_at_idx" ON "blog_posts" USING btree ("updated_at");
  CREATE INDEX "blog_posts_created_at_idx" ON "blog_posts" USING btree ("created_at");
  CREATE INDEX "blog_posts__status_idx" ON "blog_posts" USING btree ("_status");
  CREATE INDEX "_blog_posts_v_parent_idx" ON "_blog_posts_v" USING btree ("parent_id");
  CREATE INDEX "_blog_posts_v_version_version_slug_idx" ON "_blog_posts_v" USING btree ("version_slug");
  CREATE INDEX "_blog_posts_v_version_version_cover_image_idx" ON "_blog_posts_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_blog_posts_v_version_version_category_idx" ON "_blog_posts_v" USING btree ("version_category_id");
  CREATE INDEX "_blog_posts_v_version_version_published_at_idx" ON "_blog_posts_v" USING btree ("version_published_at");
  CREATE INDEX "_blog_posts_v_version_version_updated_at_idx" ON "_blog_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_blog_posts_v_version_version_created_at_idx" ON "_blog_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_blog_posts_v_version_version__status_idx" ON "_blog_posts_v" USING btree ("version__status");
  CREATE INDEX "_blog_posts_v_created_at_idx" ON "_blog_posts_v" USING btree ("created_at");
  CREATE INDEX "_blog_posts_v_updated_at_idx" ON "_blog_posts_v" USING btree ("updated_at");
  CREATE INDEX "_blog_posts_v_snapshot_idx" ON "_blog_posts_v" USING btree ("snapshot");
  CREATE INDEX "_blog_posts_v_published_locale_idx" ON "_blog_posts_v" USING btree ("published_locale");
  CREATE INDEX "_blog_posts_v_latest_idx" ON "_blog_posts_v" USING btree ("latest");
  CREATE INDEX "services_tags_order_idx" ON "services_tags" USING btree ("_order");
  CREATE INDEX "services_tags_parent_id_idx" ON "services_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "services_slug_idx" ON "services" USING btree ("slug");
  CREATE INDEX "services_raw_media_idx" ON "services" USING btree ("raw_media_id");
  CREATE INDEX "services_mockup_media_idx" ON "services" USING btree ("mockup_media_id");
  CREATE INDEX "services_updated_at_idx" ON "services" USING btree ("updated_at");
  CREATE INDEX "services_created_at_idx" ON "services" USING btree ("created_at");
  CREATE INDEX "case_studies_image_gallery_order_idx" ON "case_studies_image_gallery" USING btree ("_order");
  CREATE INDEX "case_studies_image_gallery_parent_id_idx" ON "case_studies_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "case_studies_image_gallery_image_idx" ON "case_studies_image_gallery" USING btree ("image_id");
  CREATE INDEX "case_studies_video_gallery_order_idx" ON "case_studies_video_gallery" USING btree ("_order");
  CREATE INDEX "case_studies_video_gallery_parent_id_idx" ON "case_studies_video_gallery" USING btree ("_parent_id");
  CREATE INDEX "case_studies_video_gallery_video_file_idx" ON "case_studies_video_gallery" USING btree ("video_file_id");
  CREATE UNIQUE INDEX "case_studies_slug_idx" ON "case_studies" USING btree ("slug");
  CREATE INDEX "case_studies_cover_image_idx" ON "case_studies" USING btree ("cover_image_id");
  CREATE INDEX "case_studies_updated_at_idx" ON "case_studies" USING btree ("updated_at");
  CREATE INDEX "case_studies_created_at_idx" ON "case_studies" USING btree ("created_at");
  CREATE UNIQUE INDEX "offers_slug_idx" ON "offers" USING btree ("slug");
  CREATE INDEX "offers_image_idx" ON "offers" USING btree ("image_id");
  CREATE INDEX "offers_updated_at_idx" ON "offers" USING btree ("updated_at");
  CREATE INDEX "offers_created_at_idx" ON "offers" USING btree ("created_at");
  CREATE INDEX "testimonials_avatar_idx" ON "testimonials" USING btree ("avatar_id");
  CREATE INDEX "testimonials_video_file_idx" ON "testimonials" USING btree ("video_file_id");
  CREATE INDEX "testimonials_updated_at_idx" ON "testimonials" USING btree ("updated_at");
  CREATE INDEX "testimonials_created_at_idx" ON "testimonials" USING btree ("created_at");
  CREATE INDEX "faqs_updated_at_idx" ON "faqs" USING btree ("updated_at");
  CREATE INDEX "faqs_created_at_idx" ON "faqs" USING btree ("created_at");
  CREATE INDEX "webapps_logo_idx" ON "webapps" USING btree ("logo_id");
  CREATE INDEX "webapps_cover_image_idx" ON "webapps" USING btree ("cover_image_id");
  CREATE INDEX "webapps_updated_at_idx" ON "webapps" USING btree ("updated_at");
  CREATE INDEX "webapps_created_at_idx" ON "webapps" USING btree ("created_at");
  CREATE INDEX "stats_updated_at_idx" ON "stats" USING btree ("updated_at");
  CREATE INDEX "stats_created_at_idx" ON "stats" USING btree ("created_at");
  CREATE INDEX "process_steps_updated_at_idx" ON "process_steps" USING btree ("updated_at");
  CREATE INDEX "process_steps_created_at_idx" ON "process_steps" USING btree ("created_at");
  CREATE INDEX "pricing_plans_features_order_idx" ON "pricing_plans_features" USING btree ("_order");
  CREATE INDEX "pricing_plans_features_parent_id_idx" ON "pricing_plans_features" USING btree ("_parent_id");
  CREATE INDEX "pricing_plans_updated_at_idx" ON "pricing_plans" USING btree ("updated_at");
  CREATE INDEX "pricing_plans_created_at_idx" ON "pricing_plans" USING btree ("created_at");
  CREATE INDEX "calculator_services_updated_at_idx" ON "calculator_services" USING btree ("updated_at");
  CREATE INDEX "calculator_services_created_at_idx" ON "calculator_services" USING btree ("created_at");
  CREATE INDEX "clients_timeline_order_idx" ON "clients_timeline" USING btree ("_order");
  CREATE INDEX "clients_timeline_parent_id_idx" ON "clients_timeline" USING btree ("_parent_id");
  CREATE INDEX "clients_deliverables_order_idx" ON "clients_deliverables" USING btree ("_order");
  CREATE INDEX "clients_deliverables_parent_id_idx" ON "clients_deliverables" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "clients_slug_idx" ON "clients" USING btree ("slug");
  CREATE UNIQUE INDEX "clients_access_code_idx" ON "clients" USING btree ("access_code");
  CREATE INDEX "clients_onboarding_guide_idx" ON "clients" USING btree ("onboarding_guide_id");
  CREATE INDEX "clients_updated_at_idx" ON "clients" USING btree ("updated_at");
  CREATE INDEX "clients_created_at_idx" ON "clients" USING btree ("created_at");
  CREATE INDEX "invoices_items_order_idx" ON "invoices_items" USING btree ("_order");
  CREATE INDEX "invoices_items_parent_id_idx" ON "invoices_items" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "invoices_invoice_id_idx" ON "invoices" USING btree ("invoice_id");
  CREATE INDEX "invoices_client_idx" ON "invoices" USING btree ("client_id");
  CREATE INDEX "invoices_updated_at_idx" ON "invoices" USING btree ("updated_at");
  CREATE INDEX "invoices_created_at_idx" ON "invoices" USING btree ("created_at");
  CREATE INDEX "onboarding_guides_updated_at_idx" ON "onboarding_guides" USING btree ("updated_at");
  CREATE INDEX "onboarding_guides_created_at_idx" ON "onboarding_guides" USING btree ("created_at");
  CREATE INDEX "pages_blocks_hero_section_buttons_order_idx" ON "pages_blocks_hero_section_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_section_buttons_parent_id_idx" ON "pages_blocks_hero_section_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_section_order_idx" ON "pages_blocks_hero_section" USING btree ("_order");
  CREATE INDEX "pages_blocks_hero_section_parent_id_idx" ON "pages_blocks_hero_section" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_hero_section_path_idx" ON "pages_blocks_hero_section" USING btree ("_path");
  CREATE INDEX "pages_blocks_hero_section_background_image_idx" ON "pages_blocks_hero_section" USING btree ("background_image_id");
  CREATE INDEX "pages_blocks_text_block_order_idx" ON "pages_blocks_text_block" USING btree ("_order");
  CREATE INDEX "pages_blocks_text_block_parent_id_idx" ON "pages_blocks_text_block" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_text_block_path_idx" ON "pages_blocks_text_block" USING btree ("_path");
  CREATE INDEX "pages_blocks_image_gallery_images_order_idx" ON "pages_blocks_image_gallery_images" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_images_parent_id_idx" ON "pages_blocks_image_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_images_image_idx" ON "pages_blocks_image_gallery_images" USING btree ("image_id");
  CREATE INDEX "pages_blocks_image_gallery_order_idx" ON "pages_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "pages_blocks_image_gallery_parent_id_idx" ON "pages_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_image_gallery_path_idx" ON "pages_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "pages_blocks_call_to_action_buttons_order_idx" ON "pages_blocks_call_to_action_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_call_to_action_buttons_parent_id_idx" ON "pages_blocks_call_to_action_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_call_to_action_order_idx" ON "pages_blocks_call_to_action" USING btree ("_order");
  CREATE INDEX "pages_blocks_call_to_action_parent_id_idx" ON "pages_blocks_call_to_action" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_call_to_action_path_idx" ON "pages_blocks_call_to_action" USING btree ("_path");
  CREATE INDEX "pages_blocks_feature_grid_features_order_idx" ON "pages_blocks_feature_grid_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_features_parent_id_idx" ON "pages_blocks_feature_grid_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_features_icon_idx" ON "pages_blocks_feature_grid_features" USING btree ("icon_id");
  CREATE INDEX "pages_blocks_feature_grid_order_idx" ON "pages_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_feature_grid_parent_id_idx" ON "pages_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_feature_grid_path_idx" ON "pages_blocks_feature_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_testimonial_slider_testimonials_order_idx" ON "pages_blocks_testimonial_slider_testimonials" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonial_slider_testimonials_parent_id_idx" ON "pages_blocks_testimonial_slider_testimonials" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonial_slider_testimonials_author_imag_idx" ON "pages_blocks_testimonial_slider_testimonials" USING btree ("author_image_id");
  CREATE INDEX "pages_blocks_testimonial_slider_testimonials_company_log_idx" ON "pages_blocks_testimonial_slider_testimonials" USING btree ("company_logo_id");
  CREATE INDEX "pages_blocks_testimonial_slider_order_idx" ON "pages_blocks_testimonial_slider" USING btree ("_order");
  CREATE INDEX "pages_blocks_testimonial_slider_parent_id_idx" ON "pages_blocks_testimonial_slider" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_testimonial_slider_path_idx" ON "pages_blocks_testimonial_slider" USING btree ("_path");
  CREATE INDEX "pages_blocks_faq_accordion_faqs_order_idx" ON "pages_blocks_faq_accordion_faqs" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_accordion_faqs_parent_id_idx" ON "pages_blocks_faq_accordion_faqs" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_order_idx" ON "pages_blocks_faq_accordion" USING btree ("_order");
  CREATE INDEX "pages_blocks_faq_accordion_parent_id_idx" ON "pages_blocks_faq_accordion" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_faq_accordion_path_idx" ON "pages_blocks_faq_accordion" USING btree ("_path");
  CREATE INDEX "pages_blocks_video_embed_order_idx" ON "pages_blocks_video_embed" USING btree ("_order");
  CREATE INDEX "pages_blocks_video_embed_parent_id_idx" ON "pages_blocks_video_embed" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_video_embed_path_idx" ON "pages_blocks_video_embed" USING btree ("_path");
  CREATE INDEX "pages_blocks_video_embed_thumbnail_image_idx" ON "pages_blocks_video_embed" USING btree ("thumbnail_image_id");
  CREATE INDEX "pages_blocks_pricing_cards_cards_features_order_idx" ON "pages_blocks_pricing_cards_cards_features" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_cards_cards_features_parent_id_idx" ON "pages_blocks_pricing_cards_cards_features" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pricing_cards_cards_order_idx" ON "pages_blocks_pricing_cards_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_cards_cards_parent_id_idx" ON "pages_blocks_pricing_cards_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pricing_cards_order_idx" ON "pages_blocks_pricing_cards" USING btree ("_order");
  CREATE INDEX "pages_blocks_pricing_cards_parent_id_idx" ON "pages_blocks_pricing_cards" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_pricing_cards_path_idx" ON "pages_blocks_pricing_cards" USING btree ("_path");
  CREATE INDEX "pages_blocks_team_grid_members_order_idx" ON "pages_blocks_team_grid_members" USING btree ("_order");
  CREATE INDEX "pages_blocks_team_grid_members_parent_id_idx" ON "pages_blocks_team_grid_members" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_team_grid_members_image_idx" ON "pages_blocks_team_grid_members" USING btree ("image_id");
  CREATE INDEX "pages_blocks_team_grid_order_idx" ON "pages_blocks_team_grid" USING btree ("_order");
  CREATE INDEX "pages_blocks_team_grid_parent_id_idx" ON "pages_blocks_team_grid" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_team_grid_path_idx" ON "pages_blocks_team_grid" USING btree ("_path");
  CREATE INDEX "pages_blocks_logo_cloud_logos_order_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("_order");
  CREATE INDEX "pages_blocks_logo_cloud_logos_parent_id_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logo_cloud_logos_logo_idx" ON "pages_blocks_logo_cloud_logos" USING btree ("logo_id");
  CREATE INDEX "pages_blocks_logo_cloud_order_idx" ON "pages_blocks_logo_cloud" USING btree ("_order");
  CREATE INDEX "pages_blocks_logo_cloud_parent_id_idx" ON "pages_blocks_logo_cloud" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_logo_cloud_path_idx" ON "pages_blocks_logo_cloud" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_and_text_buttons_order_idx" ON "pages_blocks_media_and_text_buttons" USING btree ("_order");
  CREATE INDEX "pages_blocks_media_and_text_buttons_parent_id_idx" ON "pages_blocks_media_and_text_buttons" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_media_and_text_order_idx" ON "pages_blocks_media_and_text" USING btree ("_order");
  CREATE INDEX "pages_blocks_media_and_text_parent_id_idx" ON "pages_blocks_media_and_text" USING btree ("_parent_id");
  CREATE INDEX "pages_blocks_media_and_text_path_idx" ON "pages_blocks_media_and_text" USING btree ("_path");
  CREATE INDEX "pages_blocks_media_and_text_media_idx" ON "pages_blocks_media_and_text" USING btree ("media_id");
  CREATE UNIQUE INDEX "pages_slug_idx" ON "pages" USING btree ("slug");
  CREATE INDEX "pages_updated_at_idx" ON "pages" USING btree ("updated_at");
  CREATE INDEX "pages_created_at_idx" ON "pages" USING btree ("created_at");
  CREATE INDEX "pages__status_idx" ON "pages" USING btree ("_status");
  CREATE INDEX "_pages_v_blocks_hero_section_buttons_order_idx" ON "_pages_v_blocks_hero_section_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_section_buttons_parent_id_idx" ON "_pages_v_blocks_hero_section_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_section_order_idx" ON "_pages_v_blocks_hero_section" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_hero_section_parent_id_idx" ON "_pages_v_blocks_hero_section" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_hero_section_path_idx" ON "_pages_v_blocks_hero_section" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_hero_section_background_image_idx" ON "_pages_v_blocks_hero_section" USING btree ("background_image_id");
  CREATE INDEX "_pages_v_blocks_text_block_order_idx" ON "_pages_v_blocks_text_block" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_text_block_parent_id_idx" ON "_pages_v_blocks_text_block" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_text_block_path_idx" ON "_pages_v_blocks_text_block" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_image_gallery_images_order_idx" ON "_pages_v_blocks_image_gallery_images" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_gallery_images_parent_id_idx" ON "_pages_v_blocks_image_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_images_image_idx" ON "_pages_v_blocks_image_gallery_images" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_order_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_image_gallery_parent_id_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_image_gallery_path_idx" ON "_pages_v_blocks_image_gallery" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_call_to_action_buttons_order_idx" ON "_pages_v_blocks_call_to_action_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_call_to_action_buttons_parent_id_idx" ON "_pages_v_blocks_call_to_action_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_call_to_action_order_idx" ON "_pages_v_blocks_call_to_action" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_call_to_action_parent_id_idx" ON "_pages_v_blocks_call_to_action" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_call_to_action_path_idx" ON "_pages_v_blocks_call_to_action" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_feature_grid_features_order_idx" ON "_pages_v_blocks_feature_grid_features" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_features_parent_id_idx" ON "_pages_v_blocks_feature_grid_features" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_features_icon_idx" ON "_pages_v_blocks_feature_grid_features" USING btree ("icon_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_order_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_feature_grid_parent_id_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_feature_grid_path_idx" ON "_pages_v_blocks_feature_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_testimonials_order_idx" ON "_pages_v_blocks_testimonial_slider_testimonials" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_testimonials_parent_id_idx" ON "_pages_v_blocks_testimonial_slider_testimonials" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_testimonials_author_i_idx" ON "_pages_v_blocks_testimonial_slider_testimonials" USING btree ("author_image_id");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_testimonials_company__idx" ON "_pages_v_blocks_testimonial_slider_testimonials" USING btree ("company_logo_id");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_order_idx" ON "_pages_v_blocks_testimonial_slider" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_parent_id_idx" ON "_pages_v_blocks_testimonial_slider" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_testimonial_slider_path_idx" ON "_pages_v_blocks_testimonial_slider" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_faq_accordion_faqs_order_idx" ON "_pages_v_blocks_faq_accordion_faqs" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_accordion_faqs_parent_id_idx" ON "_pages_v_blocks_faq_accordion_faqs" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_order_idx" ON "_pages_v_blocks_faq_accordion" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_faq_accordion_parent_id_idx" ON "_pages_v_blocks_faq_accordion" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_faq_accordion_path_idx" ON "_pages_v_blocks_faq_accordion" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_video_embed_order_idx" ON "_pages_v_blocks_video_embed" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_video_embed_parent_id_idx" ON "_pages_v_blocks_video_embed" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_video_embed_path_idx" ON "_pages_v_blocks_video_embed" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_video_embed_thumbnail_image_idx" ON "_pages_v_blocks_video_embed" USING btree ("thumbnail_image_id");
  CREATE INDEX "_pages_v_blocks_pricing_cards_cards_features_order_idx" ON "_pages_v_blocks_pricing_cards_cards_features" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_pricing_cards_cards_features_parent_id_idx" ON "_pages_v_blocks_pricing_cards_cards_features" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_pricing_cards_cards_order_idx" ON "_pages_v_blocks_pricing_cards_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_pricing_cards_cards_parent_id_idx" ON "_pages_v_blocks_pricing_cards_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_pricing_cards_order_idx" ON "_pages_v_blocks_pricing_cards" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_pricing_cards_parent_id_idx" ON "_pages_v_blocks_pricing_cards" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_pricing_cards_path_idx" ON "_pages_v_blocks_pricing_cards" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_team_grid_members_order_idx" ON "_pages_v_blocks_team_grid_members" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_team_grid_members_parent_id_idx" ON "_pages_v_blocks_team_grid_members" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_team_grid_members_image_idx" ON "_pages_v_blocks_team_grid_members" USING btree ("image_id");
  CREATE INDEX "_pages_v_blocks_team_grid_order_idx" ON "_pages_v_blocks_team_grid" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_team_grid_parent_id_idx" ON "_pages_v_blocks_team_grid" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_team_grid_path_idx" ON "_pages_v_blocks_team_grid" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_logo_cloud_logos_order_idx" ON "_pages_v_blocks_logo_cloud_logos" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_logo_cloud_logos_parent_id_idx" ON "_pages_v_blocks_logo_cloud_logos" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_logo_cloud_logos_logo_idx" ON "_pages_v_blocks_logo_cloud_logos" USING btree ("logo_id");
  CREATE INDEX "_pages_v_blocks_logo_cloud_order_idx" ON "_pages_v_blocks_logo_cloud" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_logo_cloud_parent_id_idx" ON "_pages_v_blocks_logo_cloud" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_logo_cloud_path_idx" ON "_pages_v_blocks_logo_cloud" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_and_text_buttons_order_idx" ON "_pages_v_blocks_media_and_text_buttons" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_media_and_text_buttons_parent_id_idx" ON "_pages_v_blocks_media_and_text_buttons" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_media_and_text_order_idx" ON "_pages_v_blocks_media_and_text" USING btree ("_order");
  CREATE INDEX "_pages_v_blocks_media_and_text_parent_id_idx" ON "_pages_v_blocks_media_and_text" USING btree ("_parent_id");
  CREATE INDEX "_pages_v_blocks_media_and_text_path_idx" ON "_pages_v_blocks_media_and_text" USING btree ("_path");
  CREATE INDEX "_pages_v_blocks_media_and_text_media_idx" ON "_pages_v_blocks_media_and_text" USING btree ("media_id");
  CREATE INDEX "_pages_v_parent_idx" ON "_pages_v" USING btree ("parent_id");
  CREATE INDEX "_pages_v_version_version_slug_idx" ON "_pages_v" USING btree ("version_slug");
  CREATE INDEX "_pages_v_version_version_updated_at_idx" ON "_pages_v" USING btree ("version_updated_at");
  CREATE INDEX "_pages_v_version_version_created_at_idx" ON "_pages_v" USING btree ("version_created_at");
  CREATE INDEX "_pages_v_version_version__status_idx" ON "_pages_v" USING btree ("version__status");
  CREATE INDEX "_pages_v_created_at_idx" ON "_pages_v" USING btree ("created_at");
  CREATE INDEX "_pages_v_updated_at_idx" ON "_pages_v" USING btree ("updated_at");
  CREATE INDEX "_pages_v_snapshot_idx" ON "_pages_v" USING btree ("snapshot");
  CREATE INDEX "_pages_v_published_locale_idx" ON "_pages_v" USING btree ("published_locale");
  CREATE INDEX "_pages_v_latest_idx" ON "_pages_v" USING btree ("latest");
  CREATE INDEX "email_campaigns_updated_at_idx" ON "email_campaigns" USING btree ("updated_at");
  CREATE INDEX "email_campaigns_created_at_idx" ON "email_campaigns" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_folders_id_idx" ON "payload_locked_documents_rels" USING btree ("folders_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");
  CREATE INDEX "payload_locked_documents_rels_leads_id_idx" ON "payload_locked_documents_rels" USING btree ("leads_id");
  CREATE INDEX "payload_locked_documents_rels_blog_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_categories_id");
  CREATE INDEX "payload_locked_documents_rels_blog_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("blog_posts_id");
  CREATE INDEX "payload_locked_documents_rels_services_id_idx" ON "payload_locked_documents_rels" USING btree ("services_id");
  CREATE INDEX "payload_locked_documents_rels_case_studies_id_idx" ON "payload_locked_documents_rels" USING btree ("case_studies_id");
  CREATE INDEX "payload_locked_documents_rels_offers_id_idx" ON "payload_locked_documents_rels" USING btree ("offers_id");
  CREATE INDEX "payload_locked_documents_rels_testimonials_id_idx" ON "payload_locked_documents_rels" USING btree ("testimonials_id");
  CREATE INDEX "payload_locked_documents_rels_faqs_id_idx" ON "payload_locked_documents_rels" USING btree ("faqs_id");
  CREATE INDEX "payload_locked_documents_rels_webapps_id_idx" ON "payload_locked_documents_rels" USING btree ("webapps_id");
  CREATE INDEX "payload_locked_documents_rels_stats_id_idx" ON "payload_locked_documents_rels" USING btree ("stats_id");
  CREATE INDEX "payload_locked_documents_rels_process_steps_id_idx" ON "payload_locked_documents_rels" USING btree ("process_steps_id");
  CREATE INDEX "payload_locked_documents_rels_pricing_plans_id_idx" ON "payload_locked_documents_rels" USING btree ("pricing_plans_id");
  CREATE INDEX "payload_locked_documents_rels_calculator_services_id_idx" ON "payload_locked_documents_rels" USING btree ("calculator_services_id");
  CREATE INDEX "payload_locked_documents_rels_clients_id_idx" ON "payload_locked_documents_rels" USING btree ("clients_id");
  CREATE INDEX "payload_locked_documents_rels_invoices_id_idx" ON "payload_locked_documents_rels" USING btree ("invoices_id");
  CREATE INDEX "payload_locked_documents_rels_onboarding_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("onboarding_guides_id");
  CREATE INDEX "payload_locked_documents_rels_pages_id_idx" ON "payload_locked_documents_rels" USING btree ("pages_id");
  CREATE INDEX "payload_locked_documents_rels_email_campaigns_id_idx" ON "payload_locked_documents_rels" USING btree ("email_campaigns_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_social_links_order_idx" ON "site_settings_social_links" USING btree ("_order");
  CREATE INDEX "site_settings_social_links_parent_id_idx" ON "site_settings_social_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_client_logos_order_idx" ON "site_settings_client_logos" USING btree ("_order");
  CREATE INDEX "site_settings_client_logos_parent_id_idx" ON "site_settings_client_logos" USING btree ("_parent_id");
  CREATE INDEX "site_settings_client_logos_logo_idx" ON "site_settings_client_logos" USING btree ("logo_id");
  CREATE INDEX "site_settings_nav_links_order_idx" ON "site_settings_nav_links" USING btree ("_order");
  CREATE INDEX "site_settings_nav_links_parent_id_idx" ON "site_settings_nav_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_footer_links_order_idx" ON "site_settings_footer_links" USING btree ("_order");
  CREATE INDEX "site_settings_footer_links_parent_id_idx" ON "site_settings_footer_links" USING btree ("_parent_id");
  CREATE INDEX "site_settings_certifications_order_idx" ON "site_settings_certifications" USING btree ("_order");
  CREATE INDEX "site_settings_certifications_parent_id_idx" ON "site_settings_certifications" USING btree ("_parent_id");
  CREATE INDEX "site_settings_certifications_badge_idx" ON "site_settings_certifications" USING btree ("badge_id");
  CREATE INDEX "homepage_hero_services_order_idx" ON "homepage_hero_services" USING btree ("_order");
  CREATE INDEX "homepage_hero_services_parent_id_idx" ON "homepage_hero_services" USING btree ("_parent_id");
  CREATE INDEX "homepage_hero_services_raw_media_idx" ON "homepage_hero_services" USING btree ("raw_media_id");
  CREATE INDEX "homepage_hero_services_mockup_media_idx" ON "homepage_hero_services" USING btree ("mockup_media_id");
  CREATE INDEX "homepage_trust_highlights_order_idx" ON "homepage_trust_highlights" USING btree ("_order");
  CREATE INDEX "homepage_trust_highlights_parent_id_idx" ON "homepage_trust_highlights" USING btree ("_parent_id");
  CREATE INDEX "homepage_founder_text_order_idx" ON "homepage_founder_text" USING btree ("_order");
  CREATE INDEX "homepage_founder_text_parent_id_idx" ON "homepage_founder_text" USING btree ("_parent_id");
  CREATE INDEX "homepage_founder_image_idx" ON "homepage" USING btree ("founder_image_id");
  CREATE INDEX "about_core_values_order_idx" ON "about_core_values" USING btree ("_order");
  CREATE INDEX "about_core_values_parent_id_idx" ON "about_core_values" USING btree ("_parent_id");
  CREATE INDEX "about_founder_image_idx" ON "about" USING btree ("founder_image_id");
  CREATE INDEX "quaderp_page_trust_badges_order_idx" ON "quaderp_page_trust_badges" USING btree ("_order");
  CREATE INDEX "quaderp_page_trust_badges_parent_id_idx" ON "quaderp_page_trust_badges" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_features_order_idx" ON "quaderp_page_features" USING btree ("_order");
  CREATE INDEX "quaderp_page_features_parent_id_idx" ON "quaderp_page_features" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_showcase_items_bullet_points_order_idx" ON "quaderp_page_showcase_items_bullet_points" USING btree ("_order");
  CREATE INDEX "quaderp_page_showcase_items_bullet_points_parent_id_idx" ON "quaderp_page_showcase_items_bullet_points" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_showcase_items_order_idx" ON "quaderp_page_showcase_items" USING btree ("_order");
  CREATE INDEX "quaderp_page_showcase_items_parent_id_idx" ON "quaderp_page_showcase_items" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_pricing_plans_features_order_idx" ON "quaderp_page_pricing_plans_features" USING btree ("_order");
  CREATE INDEX "quaderp_page_pricing_plans_features_parent_id_idx" ON "quaderp_page_pricing_plans_features" USING btree ("_parent_id");
  CREATE INDEX "quaderp_page_pricing_plans_order_idx" ON "quaderp_page_pricing_plans" USING btree ("_order");
  CREATE INDEX "quaderp_page_pricing_plans_parent_id_idx" ON "quaderp_page_pricing_plans" USING btree ("_parent_id");
  CREATE INDEX "video_production_page_services_section_services_order_idx" ON "video_production_page_services_section_services" USING btree ("_order");
  CREATE INDEX "video_production_page_services_section_services_parent_id_idx" ON "video_production_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX "video_production_page_process_section_steps_order_idx" ON "video_production_page_process_section_steps" USING btree ("_order");
  CREATE INDEX "video_production_page_process_section_steps_parent_id_idx" ON "video_production_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX "video_production_page_pricing_section_plans_features_order_idx" ON "video_production_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX "video_production_page_pricing_section_plans_features_parent_id_idx" ON "video_production_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX "video_production_page_pricing_section_plans_order_idx" ON "video_production_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX "video_production_page_pricing_section_plans_parent_id_idx" ON "video_production_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX "video_production_page_faq_section_faqs_order_idx" ON "video_production_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX "video_production_page_faq_section_faqs_parent_id_idx" ON "video_production_page_faq_section_faqs" USING btree ("_parent_id");
  CREATE INDEX "web_design_page_services_section_services_order_idx" ON "web_design_page_services_section_services" USING btree ("_order");
  CREATE INDEX "web_design_page_services_section_services_parent_id_idx" ON "web_design_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX "web_design_page_process_section_steps_order_idx" ON "web_design_page_process_section_steps" USING btree ("_order");
  CREATE INDEX "web_design_page_process_section_steps_parent_id_idx" ON "web_design_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX "web_design_page_pricing_section_plans_features_order_idx" ON "web_design_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX "web_design_page_pricing_section_plans_features_parent_id_idx" ON "web_design_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX "web_design_page_pricing_section_plans_order_idx" ON "web_design_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX "web_design_page_pricing_section_plans_parent_id_idx" ON "web_design_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX "web_design_page_faq_section_faqs_order_idx" ON "web_design_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX "web_design_page_faq_section_faqs_parent_id_idx" ON "web_design_page_faq_section_faqs" USING btree ("_parent_id");
  CREATE INDEX "brand_identity_page_services_section_services_order_idx" ON "brand_identity_page_services_section_services" USING btree ("_order");
  CREATE INDEX "brand_identity_page_services_section_services_parent_id_idx" ON "brand_identity_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX "brand_identity_page_process_section_steps_order_idx" ON "brand_identity_page_process_section_steps" USING btree ("_order");
  CREATE INDEX "brand_identity_page_process_section_steps_parent_id_idx" ON "brand_identity_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX "brand_identity_page_pricing_section_plans_features_order_idx" ON "brand_identity_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX "brand_identity_page_pricing_section_plans_features_parent_id_idx" ON "brand_identity_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX "brand_identity_page_pricing_section_plans_order_idx" ON "brand_identity_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX "brand_identity_page_pricing_section_plans_parent_id_idx" ON "brand_identity_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX "brand_identity_page_faq_section_faqs_order_idx" ON "brand_identity_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX "brand_identity_page_faq_section_faqs_parent_id_idx" ON "brand_identity_page_faq_section_faqs" USING btree ("_parent_id");
  CREATE INDEX "seo_page_services_section_services_features_order_idx" ON "seo_page_services_section_services_features" USING btree ("_order");
  CREATE INDEX "seo_page_services_section_services_features_parent_id_idx" ON "seo_page_services_section_services_features" USING btree ("_parent_id");
  CREATE INDEX "seo_page_services_section_services_order_idx" ON "seo_page_services_section_services" USING btree ("_order");
  CREATE INDEX "seo_page_services_section_services_parent_id_idx" ON "seo_page_services_section_services" USING btree ("_parent_id");
  CREATE INDEX "seo_page_process_section_steps_order_idx" ON "seo_page_process_section_steps" USING btree ("_order");
  CREATE INDEX "seo_page_process_section_steps_parent_id_idx" ON "seo_page_process_section_steps" USING btree ("_parent_id");
  CREATE INDEX "seo_page_pricing_section_plans_features_order_idx" ON "seo_page_pricing_section_plans_features" USING btree ("_order");
  CREATE INDEX "seo_page_pricing_section_plans_features_parent_id_idx" ON "seo_page_pricing_section_plans_features" USING btree ("_parent_id");
  CREATE INDEX "seo_page_pricing_section_plans_order_idx" ON "seo_page_pricing_section_plans" USING btree ("_order");
  CREATE INDEX "seo_page_pricing_section_plans_parent_id_idx" ON "seo_page_pricing_section_plans" USING btree ("_parent_id");
  CREATE INDEX "seo_page_faq_section_faqs_order_idx" ON "seo_page_faq_section_faqs" USING btree ("_order");
  CREATE INDEX "seo_page_faq_section_faqs_parent_id_idx" ON "seo_page_faq_section_faqs" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "folders" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "leads" CASCADE;
  DROP TABLE "blog_categories" CASCADE;
  DROP TABLE "blog_posts" CASCADE;
  DROP TABLE "_blog_posts_v" CASCADE;
  DROP TABLE "services_tags" CASCADE;
  DROP TABLE "services" CASCADE;
  DROP TABLE "case_studies_image_gallery" CASCADE;
  DROP TABLE "case_studies_video_gallery" CASCADE;
  DROP TABLE "case_studies" CASCADE;
  DROP TABLE "offers" CASCADE;
  DROP TABLE "testimonials" CASCADE;
  DROP TABLE "faqs" CASCADE;
  DROP TABLE "webapps" CASCADE;
  DROP TABLE "stats" CASCADE;
  DROP TABLE "process_steps" CASCADE;
  DROP TABLE "pricing_plans_features" CASCADE;
  DROP TABLE "pricing_plans" CASCADE;
  DROP TABLE "calculator_services" CASCADE;
  DROP TABLE "clients_timeline" CASCADE;
  DROP TABLE "clients_deliverables" CASCADE;
  DROP TABLE "clients" CASCADE;
  DROP TABLE "invoices_items" CASCADE;
  DROP TABLE "invoices" CASCADE;
  DROP TABLE "onboarding_guides" CASCADE;
  DROP TABLE "pages_blocks_hero_section_buttons" CASCADE;
  DROP TABLE "pages_blocks_hero_section" CASCADE;
  DROP TABLE "pages_blocks_text_block" CASCADE;
  DROP TABLE "pages_blocks_image_gallery_images" CASCADE;
  DROP TABLE "pages_blocks_image_gallery" CASCADE;
  DROP TABLE "pages_blocks_call_to_action_buttons" CASCADE;
  DROP TABLE "pages_blocks_call_to_action" CASCADE;
  DROP TABLE "pages_blocks_feature_grid_features" CASCADE;
  DROP TABLE "pages_blocks_feature_grid" CASCADE;
  DROP TABLE "pages_blocks_testimonial_slider_testimonials" CASCADE;
  DROP TABLE "pages_blocks_testimonial_slider" CASCADE;
  DROP TABLE "pages_blocks_faq_accordion_faqs" CASCADE;
  DROP TABLE "pages_blocks_faq_accordion" CASCADE;
  DROP TABLE "pages_blocks_video_embed" CASCADE;
  DROP TABLE "pages_blocks_pricing_cards_cards_features" CASCADE;
  DROP TABLE "pages_blocks_pricing_cards_cards" CASCADE;
  DROP TABLE "pages_blocks_pricing_cards" CASCADE;
  DROP TABLE "pages_blocks_team_grid_members" CASCADE;
  DROP TABLE "pages_blocks_team_grid" CASCADE;
  DROP TABLE "pages_blocks_logo_cloud_logos" CASCADE;
  DROP TABLE "pages_blocks_logo_cloud" CASCADE;
  DROP TABLE "pages_blocks_media_and_text_buttons" CASCADE;
  DROP TABLE "pages_blocks_media_and_text" CASCADE;
  DROP TABLE "pages" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_section_buttons" CASCADE;
  DROP TABLE "_pages_v_blocks_hero_section" CASCADE;
  DROP TABLE "_pages_v_blocks_text_block" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery_images" CASCADE;
  DROP TABLE "_pages_v_blocks_image_gallery" CASCADE;
  DROP TABLE "_pages_v_blocks_call_to_action_buttons" CASCADE;
  DROP TABLE "_pages_v_blocks_call_to_action" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid_features" CASCADE;
  DROP TABLE "_pages_v_blocks_feature_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_testimonial_slider_testimonials" CASCADE;
  DROP TABLE "_pages_v_blocks_testimonial_slider" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_accordion_faqs" CASCADE;
  DROP TABLE "_pages_v_blocks_faq_accordion" CASCADE;
  DROP TABLE "_pages_v_blocks_video_embed" CASCADE;
  DROP TABLE "_pages_v_blocks_pricing_cards_cards_features" CASCADE;
  DROP TABLE "_pages_v_blocks_pricing_cards_cards" CASCADE;
  DROP TABLE "_pages_v_blocks_pricing_cards" CASCADE;
  DROP TABLE "_pages_v_blocks_team_grid_members" CASCADE;
  DROP TABLE "_pages_v_blocks_team_grid" CASCADE;
  DROP TABLE "_pages_v_blocks_logo_cloud_logos" CASCADE;
  DROP TABLE "_pages_v_blocks_logo_cloud" CASCADE;
  DROP TABLE "_pages_v_blocks_media_and_text_buttons" CASCADE;
  DROP TABLE "_pages_v_blocks_media_and_text" CASCADE;
  DROP TABLE "_pages_v" CASCADE;
  DROP TABLE "email_campaigns" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_social_links" CASCADE;
  DROP TABLE "site_settings_client_logos" CASCADE;
  DROP TABLE "site_settings_nav_links" CASCADE;
  DROP TABLE "site_settings_footer_links" CASCADE;
  DROP TABLE "site_settings_certifications" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "homepage_hero_services" CASCADE;
  DROP TABLE "homepage_trust_highlights" CASCADE;
  DROP TABLE "homepage_founder_text" CASCADE;
  DROP TABLE "homepage" CASCADE;
  DROP TABLE "about_core_values" CASCADE;
  DROP TABLE "about" CASCADE;
  DROP TABLE "contact_page" CASCADE;
  DROP TABLE "services_page" CASCADE;
  DROP TABLE "projects_page" CASCADE;
  DROP TABLE "quaderp_page_trust_badges" CASCADE;
  DROP TABLE "quaderp_page_features" CASCADE;
  DROP TABLE "quaderp_page_showcase_items_bullet_points" CASCADE;
  DROP TABLE "quaderp_page_showcase_items" CASCADE;
  DROP TABLE "quaderp_page_pricing_plans_features" CASCADE;
  DROP TABLE "quaderp_page_pricing_plans" CASCADE;
  DROP TABLE "quaderp_page" CASCADE;
  DROP TABLE "video_production_page_services_section_services" CASCADE;
  DROP TABLE "video_production_page_process_section_steps" CASCADE;
  DROP TABLE "video_production_page_pricing_section_plans_features" CASCADE;
  DROP TABLE "video_production_page_pricing_section_plans" CASCADE;
  DROP TABLE "video_production_page_faq_section_faqs" CASCADE;
  DROP TABLE "video_production_page" CASCADE;
  DROP TABLE "web_design_page_services_section_services" CASCADE;
  DROP TABLE "web_design_page_process_section_steps" CASCADE;
  DROP TABLE "web_design_page_pricing_section_plans_features" CASCADE;
  DROP TABLE "web_design_page_pricing_section_plans" CASCADE;
  DROP TABLE "web_design_page_faq_section_faqs" CASCADE;
  DROP TABLE "web_design_page" CASCADE;
  DROP TABLE "brand_identity_page_services_section_services" CASCADE;
  DROP TABLE "brand_identity_page_process_section_steps" CASCADE;
  DROP TABLE "brand_identity_page_pricing_section_plans_features" CASCADE;
  DROP TABLE "brand_identity_page_pricing_section_plans" CASCADE;
  DROP TABLE "brand_identity_page_faq_section_faqs" CASCADE;
  DROP TABLE "brand_identity_page" CASCADE;
  DROP TABLE "seo_page_services_section_services_features" CASCADE;
  DROP TABLE "seo_page_services_section_services" CASCADE;
  DROP TABLE "seo_page_process_section_steps" CASCADE;
  DROP TABLE "seo_page_pricing_section_plans_features" CASCADE;
  DROP TABLE "seo_page_pricing_section_plans" CASCADE;
  DROP TABLE "seo_page_faq_section_faqs" CASCADE;
  DROP TABLE "seo_page" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_media_kind";
  DROP TYPE "public"."enum_leads_source";
  DROP TYPE "public"."enum_leads_status";
  DROP TYPE "public"."enum_blog_posts_status";
  DROP TYPE "public"."enum__blog_posts_v_version_status";
  DROP TYPE "public"."enum__blog_posts_v_published_locale";
  DROP TYPE "public"."enum_services_mockup_status";
  DROP TYPE "public"."enum_case_studies_project_type";
  DROP TYPE "public"."enum_clients_deliverables_category";
  DROP TYPE "public"."enum_clients_project_status";
  DROP TYPE "public"."enum_invoices_status";
  DROP TYPE "public"."enum_pages_blocks_hero_section_buttons_style";
  DROP TYPE "public"."enum_pages_blocks_image_gallery_layout";
  DROP TYPE "public"."enum_pages_blocks_call_to_action_buttons_style";
  DROP TYPE "public"."enum_pages_blocks_media_and_text_buttons_style";
  DROP TYPE "public"."enum_pages_blocks_media_and_text_media_alignment";
  DROP TYPE "public"."enum_pages_status";
  DROP TYPE "public"."enum__pages_v_blocks_hero_section_buttons_style";
  DROP TYPE "public"."enum__pages_v_blocks_image_gallery_layout";
  DROP TYPE "public"."enum__pages_v_blocks_call_to_action_buttons_style";
  DROP TYPE "public"."enum__pages_v_blocks_media_and_text_buttons_style";
  DROP TYPE "public"."enum__pages_v_blocks_media_and_text_media_alignment";
  DROP TYPE "public"."enum__pages_v_version_status";
  DROP TYPE "public"."enum__pages_v_published_locale";
  DROP TYPE "public"."enum_email_campaigns_status";
  DROP TYPE "public"."enum_site_settings_social_links_platform";
  DROP TYPE "public"."enum_homepage_hero_services_mockup_status";`)
}
