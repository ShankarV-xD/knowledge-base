# Experience at Randomwalk AI

Shankar has been a Software Developer at Randomwalk AI in Chennai since
January 2024. In that role he has shipped four full-stack applications
that run in production and are used daily by 500+ people across the
Middle East and Australia.

## AI Floor Plan Analysis Engine

The flagship project. Architectural floor plans used to take human
reviewers around two hours per drawing to inspect. Shankar built a
custom YOLOv11 pipeline that runs on Runpod GPUs and reduces that to
under five minutes per drawing, with 97% detection accuracy on rooms,
doors, and windows. The system uses OCR alongside detection to read
labels and dimensions, exposes results through a FastAPI service, and
queues long-running inference jobs through Redis.

**Stack:** YOLOv11, OCR, FastAPI, Next.js, Azure, Runpod, Redis.

## Fuel Station Monitoring System

Real-time video analytics deployed across 50+ CNG and petrol stations.
Trained on 5000+ images, the model hit 95% precision in production.
Compliance incidents at monitored stations dropped measurably within
the first months of rollout. The frontend (React/TypeScript) is what
station operators look at; the backend (FastAPI) runs the inference
and manages camera streams.

**Stack:** YOLO, OpenCV, React, TypeScript, FastAPI, Docker.

## Social Media Listening Platform

Tracks more than 50,000 social media mentions per day across five
platforms for a sitting Member of Parliament. Built on Airflow DAGs
that automate the ETL into BigQuery, with a FastAPI layer for query
and a dashboard for analysis. Handles the scale required for political
campaign monitoring.

**Stack:** Apache Airflow, Python, FastAPI, BigQuery, GCP.

## Workplace Safety & Exclusion Zones

A computer vision system that detects safety breaches across 200+
workers in real time: PPE compliance, unsafe postures, signage
violations. Sub-200ms latency end-to-end. After two months of
deployment, SOP violations at the monitored sites dropped by around
30%.

**Stack:** React, Python, FastAPI, ML, Docker.

## What Shankar values in this role

He has talked about three things that matter to him in his current
work:

1. **End-to-end ownership.** Each of these four projects is something
   he scoped, built, and shipped. He's responsible for the model
   training, the API, the frontend, and the production deployment.
   He has explicit experience with the failure modes that show up
   when ML systems hit real users.

2. **Production discipline.** The bar for these systems isn't a demo
   that works on a clean dataset; it's a system that doesn't break
   when a fuel station goes offline at 3 AM, when a worker stands in
   front of a camera in unusual lighting, or when an architect uploads
   a 200-page drawing.

3. **Customer-facing impact.** Real users in the Middle East and
   Australia depend on these systems daily. Bugs cost his employer
   directly. That changes how he thinks about defensive coding,
   monitoring, and error handling compared to side projects.

## Skills he's deepened

- **Computer vision:** YOLO model architectures, custom training,
  inference optimisation on GPUs, OpenCV pipelines.
- **Backend:** FastAPI (async, BackgroundTasks, streaming responses),
  PostgreSQL, Redis caching strategies, Docker, deployment to Azure
  and Runpod.
- **Data:** Apache Airflow for ETL orchestration, BigQuery, ingestion
  pipelines.
- **Frontend:** React with TypeScript, Next.js, Tailwind, real-time
  dashboards.
