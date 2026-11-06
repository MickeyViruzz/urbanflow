--
-- PostgreSQL database dump
--

\restrict LCIsEwuicxKH8HzgsXfbZVa8aor2sI3J9llWbUNuq8GKcJQ4Hc5rbvbWVLEru2o

-- Dumped from database version 16.15 (Homebrew)
-- Dumped by pg_dump version 16.15 (Homebrew)

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
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.analytics_events (
    id bigint NOT NULL,
    event_type character varying(40) NOT NULL,
    page_path character varying(200),
    session_hash character varying(64),
    metadata json,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: analytics_events_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.analytics_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: analytics_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.analytics_events_id_seq OWNED BY public.analytics_events.id;


--
-- Name: collection_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_logs (
    id integer NOT NULL,
    source_id integer,
    pipeline character varying(50) NOT NULL,
    triggered_by character varying(30) NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    status character varying(20) NOT NULL,
    records_fetched integer NOT NULL,
    records_inserted integer NOT NULL,
    records_updated integer NOT NULL,
    duplicates integer NOT NULL,
    rejected integer NOT NULL,
    message text
);


--
-- Name: collection_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.collection_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: collection_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.collection_logs_id_seq OWNED BY public.collection_logs.id;


--
-- Name: data_sources; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.data_sources (
    id integer NOT NULL,
    slug character varying(60) NOT NULL,
    name character varying(160) NOT NULL,
    source_type character varying(30) NOT NULL,
    base_url character varying(400),
    description text,
    licence_note character varying(300),
    is_active boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: data_sources_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.data_sources_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: data_sources_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.data_sources_id_seq OWNED BY public.data_sources.id;


--
-- Name: incidents; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.incidents (
    id integer NOT NULL,
    external_id character varying(160),
    title character varying(300) NOT NULL,
    category character varying(40) NOT NULL,
    status character varying(20) NOT NULL,
    severity character varying(20) NOT NULL,
    description text NOT NULL,
    summary text,
    location_name character varying(180),
    latitude double precision,
    longitude double precision,
    location_precision character varying(20) NOT NULL,
    start_time timestamp with time zone,
    end_time timestamp with time zone,
    published_at timestamp with time zone,
    last_updated_at timestamp with time zone,
    source_id integer NOT NULL,
    source_url character varying(600),
    origin character varying(10) NOT NULL,
    fingerprint character varying(64) NOT NULL,
    content_hash character varying(64) NOT NULL,
    raw_payload json,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_incidents_category CHECK (((category)::text = ANY ((ARRAY['Accident'::character varying, 'Road Closure'::character varying, 'Construction'::character varying, 'Traffic Diversion'::character varying, 'Public Event'::character varying, 'Parking Restriction'::character varying, 'Other'::character varying])::text[]))),
    CONSTRAINT ck_incidents_location_precision CHECK (((location_precision)::text = ANY ((ARRAY['locality'::character varying, 'segment'::character varying, 'unknown'::character varying])::text[]))),
    CONSTRAINT ck_incidents_origin CHECK (((origin)::text = ANY ((ARRAY['live'::character varying, 'demo'::character varying])::text[]))),
    CONSTRAINT ck_incidents_severity CHECK (((severity)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying])::text[]))),
    CONSTRAINT ck_incidents_status CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'upcoming'::character varying, 'resolved'::character varying, 'unknown'::character varying])::text[])))
);


--
-- Name: incidents_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.incidents_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: incidents_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.incidents_id_seq OWNED BY public.incidents.id;


--
-- Name: weather_observations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.weather_observations (
    id integer NOT NULL,
    observed_at timestamp with time zone NOT NULL,
    kind character varying(20) NOT NULL,
    temperature_c double precision,
    precipitation_mm double precision,
    precipitation_probability integer,
    wind_speed_kmh double precision,
    weather_code integer,
    condition character varying(100),
    source_id integer NOT NULL,
    origin character varying(10) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_weather_kind CHECK (((kind)::text = ANY ((ARRAY['observed'::character varying, 'forecast'::character varying])::text[])))
);


--
-- Name: weather_observations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.weather_observations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: weather_observations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.weather_observations_id_seq OWNED BY public.weather_observations.id;


--
-- Name: analytics_events id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events ALTER COLUMN id SET DEFAULT nextval('public.analytics_events_id_seq'::regclass);


--
-- Name: collection_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs ALTER COLUMN id SET DEFAULT nextval('public.collection_logs_id_seq'::regclass);


--
-- Name: data_sources id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources ALTER COLUMN id SET DEFAULT nextval('public.data_sources_id_seq'::regclass);


--
-- Name: incidents id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents ALTER COLUMN id SET DEFAULT nextval('public.incidents_id_seq'::regclass);


--
-- Name: weather_observations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_observations ALTER COLUMN id SET DEFAULT nextval('public.weather_observations_id_seq'::regclass);


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: collection_logs collection_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs
    ADD CONSTRAINT collection_logs_pkey PRIMARY KEY (id);


--
-- Name: data_sources data_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_pkey PRIMARY KEY (id);


--
-- Name: data_sources data_sources_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.data_sources
    ADD CONSTRAINT data_sources_slug_key UNIQUE (slug);


--
-- Name: incidents incidents_fingerprint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_fingerprint_key UNIQUE (fingerprint);


--
-- Name: incidents incidents_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_pkey PRIMARY KEY (id);


--
-- Name: weather_observations uq_weather_observation_source; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_observations
    ADD CONSTRAINT uq_weather_observation_source UNIQUE (observed_at, source_id);


--
-- Name: weather_observations weather_observations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_observations
    ADD CONSTRAINT weather_observations_pkey PRIMARY KEY (id);


--
-- Name: ix_analytics_events_type_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_analytics_events_type_created ON public.analytics_events USING btree (event_type, created_at);


--
-- Name: ix_collection_logs_started_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_collection_logs_started_at ON public.collection_logs USING btree (started_at);


--
-- Name: ix_incidents_category_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_incidents_category_status ON public.incidents USING btree (category, status);


--
-- Name: ix_incidents_geo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_incidents_geo ON public.incidents USING btree (latitude, longitude);


--
-- Name: ix_incidents_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_incidents_location ON public.incidents USING btree (location_name);


--
-- Name: ix_incidents_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_incidents_start_time ON public.incidents USING btree (start_time);


--
-- Name: ix_weather_observed_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_weather_observed_at ON public.weather_observations USING btree (observed_at);


--
-- Name: collection_logs collection_logs_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_logs
    ADD CONSTRAINT collection_logs_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id);


--
-- Name: incidents incidents_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.incidents
    ADD CONSTRAINT incidents_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id);


--
-- Name: weather_observations weather_observations_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.weather_observations
    ADD CONSTRAINT weather_observations_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.data_sources(id);


--
-- PostgreSQL database dump complete
--

\unrestrict LCIsEwuicxKH8HzgsXfbZVa8aor2sI3J9llWbUNuq8GKcJQ4Hc5rbvbWVLEru2o

