--
-- PostgreSQL database dump
--

\restrict IwaYfNIdf9qfaCKFKeqpkOU9uycfidP4dIiVgjrQ9uDBfJhcJIfkDDEAhdrpUUQ

-- Dumped from database version 18.3 (Homebrew)
-- Dumped by pg_dump version 18.3 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.users (id, full_name, email, password_hash, role, avatar_url, institution, bio, sso_provider, sso_id, email_verified, created_at, updated_at) FROM stdin;
d6d99e44-40c6-4090-bbba-3f912d74b7ab	Rothpanhaseth Im	imrothpanhaseth@cityuniversity.edu	$2a$12$NtLemWQmcWHRqDeXRyQHDO24NuZptHJPUyWlx2XRZxkcFMOeaYEaW	student	\N	City University of Seattle	\N	\N	\N	f	2026-05-08 14:26:39.396248-07	2026-05-08 14:26:39.396248-07
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.projects (id, name, description, owner_id, status, visibility, tags, created_at, updated_at) FROM stdin;
516cde68-dfd7-4e2d-9570-18b7c57d900f	CollabAgent	Intelligent Research Team	d6d99e44-40c6-4090-bbba-3f912d74b7ab	active	institution	{}	2026-05-14 11:19:13.547026-07	2026-05-14 11:19:13.547026-07
\.


--
-- Data for Name: agents; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.agents (id, project_id, name, type, status, config, last_active_at, created_at) FROM stdin;
\.


--
-- Data for Name: documents; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.documents (id, project_id, uploaded_by, title, content, file_url, file_type, file_size_bytes, indexed, embedding_status, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.project_members (project_id, user_id, member_role, joined_at) FROM stdin;
516cde68-dfd7-4e2d-9570-18b7c57d900f	d6d99e44-40c6-4090-bbba-3f912d74b7ab	owner	2026-05-14 11:19:13.5596-07
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.sessions (id, user_id, token_hash, expires_at, ip_address, user_agent, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.tasks (id, project_id, title, description, status, priority, assigned_to, deadline, estimated_hours, actual_hours, tags, metadata, created_by, created_at, updated_at) FROM stdin;
0b1fbf7a-c02d-4b6a-bfd1-e8937cc23f9c	516cde68-dfd7-4e2d-9570-18b7c57d900f	Presentation: Data Analysis		in_progress	medium	\N	2026-05-15 00:00:00-07	2.00	\N	{slide}	{}	d6d99e44-40c6-4090-bbba-3f912d74b7ab	2026-05-14 11:41:13.514586-07	2026-05-14 11:45:31.426642-07
8010494f-f3ce-4715-a5cd-81302ccb033d	516cde68-dfd7-4e2d-9570-18b7c57d900f	Paper: Data Analysis		in_progress	medium	\N	2026-05-15 00:00:00-07	2.00	\N	{paper}	{}	d6d99e44-40c6-4090-bbba-3f912d74b7ab	2026-05-14 11:40:03.568915-07	2026-05-14 11:45:34.299774-07
\.


--
-- Data for Name: task_dependencies; Type: TABLE DATA; Schema: public; Owner: rothpanhasethim
--

COPY public.task_dependencies (parent_task_id, child_task_id, dep_type, created_at) FROM stdin;
\.


--
-- PostgreSQL database dump complete
--

\unrestrict IwaYfNIdf9qfaCKFKeqpkOU9uycfidP4dIiVgjrQ9uDBfJhcJIfkDDEAhdrpUUQ

