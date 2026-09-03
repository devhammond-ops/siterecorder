export type UserRole = "technician" | "team_leader" | "admin";

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: UserRole;
  created_at: string;
}

export interface Installation {
  id: string;
  customer_name: string;
  order_number: string;
  date_order_received: string | null;
  date_installation: string | null;
  msisdn: string | null;
  fttx_number: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  gps_address: string | null;
  gps_lat: string | null;
  gps_lng: string | null;
  device_serial: string | null;
  network_type: string | null;
  network_box_id: string | null;
  atb_power_readings: string | null;
  cable_length: string | null;
  dead_end: string | null;
  site_id: string | null;
  status: string;
  status_comments: string | null;
  comments: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface InstallationImage {
  id: string;
  installation_id: string;
  slot: string;
  storage_path: string;
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export type ReportFrequency = "weekly" | "monthly";
export type DateRangeMode = "period" | "custom" | "all";

export interface ReportSchedule {
  id: string;
  name: string;
  frequency: ReportFrequency;
  day_of_week: number | null; // 0-6 (Sun-Sat) for weekly
  day_of_month: number | null; // 1-28 for monthly
  send_hour: number; // 0-23 UTC
  recipients: string[];
  date_range_mode: DateRangeMode;
  custom_from: string | null;
  custom_to: string | null;
  status_filter: string | null;
  active: boolean;
  last_run_at: string | null;
  created_at: string;
}

export interface ReportRun {
  id: string;
  schedule_id: string | null;
  ran_at: string;
  period_from: string | null;
  period_to: string | null;
  recipient_count: number;
  pdf_path: string | null;
  status: string;
  error: string | null;
}

export interface HsqDailyReport {
  id: string;
  report_date: string;
  site_id: string;
  location: string | null;
  task_description: string;
  prepared_by: string;
  prepared_by_name: string;
  prepared_by_signature: string;
  supervisor_id: string | null;
  supervisor_name: string | null;
  supervisor_signature: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface HsqReportWorker {
  id: string;
  report_id: string;
  user_id: string | null;
  worker_name: string;
  worker_signature: string;
  sort_order: number;
  created_at: string;
}

export interface HsqWorkerLookup {
  user_id: string;
  full_name: string;
  signature: string;
}
