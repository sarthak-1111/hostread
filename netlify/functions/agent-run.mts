// Netlify background function: runs one agent job (up to 15 minutes; regular
// functions stop at 60 s). /api/run starts it, the browser polls the job log.
import type { Config } from "@netlify/functions";
import { runJob, isJobId, type JobRequest } from "../../src/lib/runs";

export default async (req: Request) => {
  const secret = process.env.JOB_SECRET;
  if (!secret || req.headers.get("x-hostread-job") !== secret) return;
  let job: JobRequest;
  try {
    job = (await req.json()) as JobRequest;
  } catch {
    return;
  }
  if (!isJobId(job.jobId) || typeof job.key !== "string" || !job.input) return;
  // Never throw: Netlify retries a failed background invocation, which would
  // start the same run again.
  try {
    await runJob(job);
  } catch (err) {
    console.error("agent-run failed", err instanceof Error ? err.message : err);
  }
};

export const config: Config = { background: true };
