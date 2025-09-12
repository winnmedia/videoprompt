--
-- PostgreSQL database dump
--

\restrict YNOAQhIOg7Gr2ttf0hN5SkQWkPrWsx9WcFR9nN4IFetliPZgpUk3Nk3k3R6pIUl

-- Dumped from database version 16.8 (Debian 16.8-1.pgdg120+1)
-- Dumped by pg_dump version 16.10 (Ubuntu 16.10-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: Comment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Comment" (
    id text NOT NULL,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    author text,
    text text NOT NULL,
    timecode text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id text
);


--
-- Name: EmailVerification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."EmailVerification" (
    id text NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    code text,
    user_id text,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: PasswordReset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."PasswordReset" (
    id text NOT NULL,
    email text NOT NULL,
    token text NOT NULL,
    user_id text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    used_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: Preset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Preset" (
    id text NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    thumbnail_url text,
    data jsonb NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    user_id text NOT NULL,
    downloads integer DEFAULT 0 NOT NULL,
    rating double precision DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    tags jsonb NOT NULL
);


--
-- Name: Project; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Project" (
    id text NOT NULL,
    title text NOT NULL,
    description text,
    thumbnail_url text,
    status text NOT NULL,
    metadata jsonb,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text NOT NULL,
    tags jsonb,
    scenario text,
    prompt text,
    video text
);


--
-- Name: Prompt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Prompt" (
    id text NOT NULL,
    scenario_id text NOT NULL,
    metadata jsonb NOT NULL,
    timeline jsonb NOT NULL,
    negative jsonb,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text,
    ai_analysis jsonb,
    cinegenius_version text,
    generation_control jsonb,
    project_config jsonb,
    project_id text,
    user_input jsonb
);


--
-- Name: Scenario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Scenario" (
    id text NOT NULL,
    title text NOT NULL,
    logline text,
    structure4 jsonb,
    shots12 jsonb,
    pdf_url text,
    version integer DEFAULT 1 NOT NULL,
    "createdBy" text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text
);


--
-- Name: Scene; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Scene" (
    id text NOT NULL,
    title text NOT NULL,
    description text NOT NULL,
    prompt jsonb NOT NULL,
    thumbnail_url text,
    duration integer NOT NULL,
    "order" integer NOT NULL,
    status text NOT NULL,
    ai_generated boolean DEFAULT false NOT NULL,
    project_id text NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: ShareToken; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ShareToken" (
    id text NOT NULL,
    token text NOT NULL,
    role text NOT NULL,
    nickname text,
    "targetType" text NOT NULL,
    "targetId" text NOT NULL,
    expires_at timestamp(3) without time zone NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id text
);


--
-- Name: Story; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Story" (
    id text NOT NULL,
    title text NOT NULL,
    one_line_story text NOT NULL,
    genre text NOT NULL,
    tone text,
    target text,
    structure jsonb,
    user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: Timeline; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Timeline" (
    id text NOT NULL,
    project_id text NOT NULL,
    total_duration integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    beads jsonb DEFAULT '[]'::jsonb NOT NULL
);


--
-- Name: Upload; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Upload" (
    id text NOT NULL,
    filename text NOT NULL,
    original_name text NOT NULL,
    path text NOT NULL,
    mimetype text NOT NULL,
    size integer NOT NULL,
    user_id text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: User; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."User" (
    email text NOT NULL,
    avatar_url text,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    preferences jsonb,
    role text NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    username text NOT NULL,
    id text NOT NULL,
    password_hash text NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    verified_at timestamp(3) without time zone
);


--
-- Name: VideoAsset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."VideoAsset" (
    id text NOT NULL,
    prompt_id text NOT NULL,
    provider text NOT NULL,
    status text NOT NULL,
    url text,
    codec text,
    duration integer,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL,
    user_id text
);


--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id text NOT NULL,
    token text NOT NULL,
    user_id text NOT NULL,
    device_id text,
    user_agent text,
    ip_address text,
    expires_at timestamp(3) without time zone NOT NULL,
    revoked_at timestamp(3) without time zone,
    used_at timestamp(3) without time zone,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: story_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.story_templates (
    id text NOT NULL,
    name text NOT NULL,
    description text,
    category text NOT NULL,
    template jsonb NOT NULL,
    thumbnail_url text,
    is_public boolean DEFAULT false NOT NULL,
    user_id text,
    downloads integer DEFAULT 0 NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone NOT NULL
);


--
-- Name: Comment Comment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Comment"
    ADD CONSTRAINT "Comment_pkey" PRIMARY KEY (id);


--
-- Name: EmailVerification EmailVerification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerification"
    ADD CONSTRAINT "EmailVerification_pkey" PRIMARY KEY (id);


--
-- Name: PasswordReset PasswordReset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordReset"
    ADD CONSTRAINT "PasswordReset_pkey" PRIMARY KEY (id);


--
-- Name: Preset Preset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Preset"
    ADD CONSTRAINT "Preset_pkey" PRIMARY KEY (id);


--
-- Name: Project Project_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_pkey" PRIMARY KEY (id);


--
-- Name: Prompt Prompt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Prompt"
    ADD CONSTRAINT "Prompt_pkey" PRIMARY KEY (id);


--
-- Name: Scenario Scenario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Scenario"
    ADD CONSTRAINT "Scenario_pkey" PRIMARY KEY (id);


--
-- Name: Scene Scene_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Scene"
    ADD CONSTRAINT "Scene_pkey" PRIMARY KEY (id);


--
-- Name: ShareToken ShareToken_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ShareToken"
    ADD CONSTRAINT "ShareToken_pkey" PRIMARY KEY (id);


--
-- Name: Story Story_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Story"
    ADD CONSTRAINT "Story_pkey" PRIMARY KEY (id);


--
-- Name: Timeline Timeline_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Timeline"
    ADD CONSTRAINT "Timeline_pkey" PRIMARY KEY (id);


--
-- Name: Upload Upload_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Upload"
    ADD CONSTRAINT "Upload_pkey" PRIMARY KEY (id);


--
-- Name: User User_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."User"
    ADD CONSTRAINT "User_pkey" PRIMARY KEY (id);


--
-- Name: VideoAsset VideoAsset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VideoAsset"
    ADD CONSTRAINT "VideoAsset_pkey" PRIMARY KEY (id);


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: story_templates story_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.story_templates
    ADD CONSTRAINT story_templates_pkey PRIMARY KEY (id);


--
-- Name: EmailVerification_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerification_email_idx" ON public."EmailVerification" USING btree (email);


--
-- Name: EmailVerification_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "EmailVerification_token_idx" ON public."EmailVerification" USING btree (token);


--
-- Name: EmailVerification_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "EmailVerification_token_key" ON public."EmailVerification" USING btree (token);


--
-- Name: PasswordReset_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordReset_email_idx" ON public."PasswordReset" USING btree (email);


--
-- Name: PasswordReset_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX "PasswordReset_token_idx" ON public."PasswordReset" USING btree (token);


--
-- Name: PasswordReset_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "PasswordReset_token_key" ON public."PasswordReset" USING btree (token);


--
-- Name: ShareToken_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "ShareToken_token_key" ON public."ShareToken" USING btree (token);


--
-- Name: Timeline_project_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "Timeline_project_id_key" ON public."Timeline" USING btree (project_id);


--
-- Name: User_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_email_key" ON public."User" USING btree (email);


--
-- Name: User_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX "User_username_key" ON public."User" USING btree (username);


--
-- Name: refresh_tokens_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_expires_at_idx ON public.refresh_tokens USING btree (expires_at);


--
-- Name: refresh_tokens_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_token_idx ON public.refresh_tokens USING btree (token);


--
-- Name: refresh_tokens_token_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX refresh_tokens_token_key ON public.refresh_tokens USING btree (token);


--
-- Name: refresh_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_user_id_idx ON public.refresh_tokens USING btree (user_id);


--
-- Name: story_templates_category_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_templates_category_idx ON public.story_templates USING btree (category);


--
-- Name: story_templates_is_public_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_templates_is_public_idx ON public.story_templates USING btree (is_public);


--
-- Name: story_templates_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX story_templates_user_id_idx ON public.story_templates USING btree (user_id);


--
-- Name: EmailVerification EmailVerification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."EmailVerification"
    ADD CONSTRAINT "EmailVerification_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: PasswordReset PasswordReset_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."PasswordReset"
    ADD CONSTRAINT "PasswordReset_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: Project Project_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Project"
    ADD CONSTRAINT "Project_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Prompt Prompt_scenario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Prompt"
    ADD CONSTRAINT "Prompt_scenario_id_fkey" FOREIGN KEY (scenario_id) REFERENCES public."Scenario"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Scene Scene_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Scene"
    ADD CONSTRAINT "Scene_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: Timeline Timeline_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Timeline"
    ADD CONSTRAINT "Timeline_project_id_fkey" FOREIGN KEY (project_id) REFERENCES public."Project"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: VideoAsset VideoAsset_prompt_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."VideoAsset"
    ADD CONSTRAINT "VideoAsset_prompt_id_fkey" FOREIGN KEY (prompt_id) REFERENCES public."Prompt"(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public."User"(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict YNOAQhIOg7Gr2ttf0hN5SkQWkPrWsx9WcFR9nN4IFetliPZgpUk3Nk3k3R6pIUl

