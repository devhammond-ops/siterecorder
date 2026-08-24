// Central definitions for customer fields.
// Keep this in sync with the DB columns in supabase/migrations.

export type FieldType = "text" | "date" | "number" | "textarea";

export interface CustomerFieldDef {
  key: string;
  label: string;
  type: FieldType;
  /** Required when submitting a complete (non-draft) entry. */
  required?: boolean;
  placeholder?: string;
  /** Width hint for the responsive form grid. */
  span?: 1 | 2;
}

// Customer information captured per installation (matches the paper form).
export const CUSTOMER_FIELDS: CustomerFieldDef[] = [
  { key: "customer_name", label: "Customer Name", type: "text", required: true, span: 1 },
  { key: "order_number", label: "Order Number", type: "text", required: true, span: 1 },
  { key: "date_order_received", label: "Date Order Received", type: "date", required: true, span: 1 },
  { key: "date_installation", label: "Date Installation Activity", type: "date", required: true, span: 1 },
  { key: "msisdn", label: "MSISDN", type: "text", required: true, span: 1 },
  { key: "fttx_number", label: "FTTX Number", type: "text", required: true, span: 1 },
  { key: "customer_phone", label: "Customer Phone Details", type: "text", required: true, span: 1 },
  { key: "customer_address", label: "Customer Address", type: "textarea", required: true, span: 2 },
  { key: "gps_address", label: "Ghana Post Address", type: "text", required: true, span: 2 },
  { key: "gps_lat", label: "GPS Latitude", type: "text", required: true, span: 1 },
  { key: "gps_lng", label: "GPS Longitude", type: "text", required: true, span: 1 },
  { key: "device_serial", label: "S/N - Installed Device", type: "text", required: true, span: 1 },
  {
    key: "network_type",
    label: "Network Type",
    type: "text",
    required: true,
    placeholder: "e.g. Quick ODN",
    span: 1,
  },
  { key: "network_box_id", label: "Network Box ID", type: "text", required: true, span: 1 },
  { key: "atb_power_readings", label: "ATB Power Readings", type: "text", required: true, span: 1 },
  { key: "cable_length", label: "Cable Length", type: "text", required: true, span: 1 },
  { key: "dead_end", label: "Dead End", type: "text", required: true, span: 1 },
];

export const INSTALLATION_STATUSES = [
  "Draft",
  "Pending",
  "In Progress",
  "Good",
  "Failed",
  "Rework",
] as const;

export type InstallationStatus = (typeof INSTALLATION_STATUSES)[number];

export const DRAFT_STATUS = "Draft";

/** Stored in installation_images.slot for new uploads (DB column kept for compatibility). */
export const DEFAULT_IMAGE_SLOT = "photo";

export const STORAGE_BUCKET = "installation-images";
export const REPORTS_BUCKET = "reports";
