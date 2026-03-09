/**
 * Jobs Store - Svelte 5
 * Real-time job updates using runes
 */

export interface Job {
	job_id: string;
	user_id: string;
	workflow_id: string;
	status: 'pending' | 'processing' | 'completed' | 'failed';
	input_data: Record<string, unknown>;
	output_data: Record<string, unknown> | null;
	credits_used: number;
	error_message: string | null;
	created_at: string;
	updated_at: string;
	completed_at: string | null;
}

let jobs = $state<Job[]>([]);
let isLoading = $state(false);

export const jobsState = {
	get items() {
		return jobs;
	},

	get isLoading() {
		return isLoading;
	},

	async fetchJobs() {
		isLoading = true;
		try {
			const response = await fetch('/api/jobs');
			if (response.ok) {
				jobs = await response.json();
			}
		} catch (error) {
			console.error('Failed to fetch jobs:', error);
		} finally {
			isLoading = false;
		}
	},

	async fetchJobById(jobId: string): Promise<Job | null> {
		try {
			const response = await fetch(`/api/jobs/${jobId}`);
			if (response.ok) {
				return await response.json();
			}
			return null;
		} catch (error) {
			console.error('Failed to fetch job:', error);
			return null;
		}
	},

	updateJob(job: Job) {
		const index = jobs.findIndex((j) => j.job_id === job.job_id);
		if (index !== -1) {
			jobs[index] = job;
		} else {
			jobs = [job, ...jobs];
		}
	}
};
