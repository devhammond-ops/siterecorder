/** Standard FTTH hazard assessment rows for HSQ daily reports. */
export const HSQ_HAZARD_ROWS = [
  {
    taskStep: "Stringing the cable on the pole to the customer's premises",
    hazards: "Installer could fall off the ladder",
    initialRisk: "H",
    precautions: "Using the safety belt and maintaining three points of contact on the ladder",
    finalRisk: "L",
  },
  {
    taskStep: "Crossing road with drop cable",
    hazards: "Installer can be hit by a vehicle when crossing road",
    initialRisk: "H",
    precautions: "Another team member stops traffic to allow safe crossing with drop cable",
    finalRisk: "L",
  },
  {
    taskStep: "Installing and mounting the ONT/CPE at customer premises",
    hazards: "Electrical shock from existing power outlets; drill dust inhalation",
    initialRisk: "M",
    precautions: "Verify power is off at socket; use dust mask; keep work area ventilated",
    finalRisk: "L",
  },
  {
    taskStep: "Terminating fibre at the ATB / network box",
    hazards: "Eye injury from fibre shards; cuts from sharp tools",
    initialRisk: "M",
    precautions: "Wear safety glasses and cut-resistant gloves; dispose of fibre scraps in sealed container",
    finalRisk: "L",
  },
  {
    taskStep: "Testing signal and ATB power readings at pole or distribution point",
    hazards: "Working at height near live equipment; sun/heat exposure",
    initialRisk: "H",
    precautions: "Use fall-arrest harness; take hydration breaks; test equipment before climbing",
    finalRisk: "L",
  },
  {
    taskStep: "Customer handover and acceptance form completion",
    hazards: "Slip/trip hazards from cables and tools in customer home",
    initialRisk: "L",
    precautions: "Keep walkways clear; coil excess cable; brief customer on safe cable routing",
    finalRisk: "L",
  },
] as const;

export const HSQ_COMPANY = "HELPDESK+";
export const HSQ_SBC = "TheHelpDeskPlus Limited";
export const HSQ_DEFAULT_TASK = "FTTH";

export const HSQ_PROBABILITY_LABELS = [
  { value: 5, label: "Frequent", definition: "Expected to occur during task/activity", ratio: "9/10" },
  { value: 4, label: "Probable", definition: "Likely to occur during task/activity", ratio: "1/10" },
  { value: 3, label: "Occasional", definition: "May occur during the task/activity", ratio: "1/100" },
  { value: 2, label: "Remote", definition: "Unlikely to occur during task/activity", ratio: "1/1,000" },
  { value: 1, label: "Improbable", definition: "Highly unlikely to occur, but possible during task/activity", ratio: "1/10,000" },
] as const;

export const HSQ_SEVERITY_LABELS = [
  { value: 5, label: "Catastrophic" },
  { value: 4, label: "Critical" },
  { value: 3, label: "Major" },
  { value: 2, label: "Moderate" },
  { value: 1, label: "Minor" },
] as const;

export const HSQ_SEVERITY_CONSEQUENCES = [
  {
    label: "Catastrophic",
    people: "Fatality, Multiple Major Incidents",
    property: ">$1M USD, Structural collapse",
    environment: "Offsite impact requiring remediation",
    reputation: "Government intervention",
  },
  {
    label: "Critical",
    people: "Permanent impairment, Long term injury/illness",
    property: ">$250K to $1M USD",
    environment: "Onsite impact requiring remediation",
    reputation: "Media intervention",
  },
  {
    label: "Major",
    people: "Lost/Restricted Work",
    property: ">$10K to $250K USD",
    environment: "Release at/above reportable limit",
    reputation: "Owner intervention",
  },
  {
    label: "Moderate",
    people: "Medical Treatment",
    property: ">$1K to $10K USD",
    environment: "Release below reportable limit",
    reputation: "Community or local attention",
  },
  {
    label: "Minor",
    people: "First Aid",
    property: "<= $1K USD",
    environment: "Small chemical release contained onsite",
    reputation: "Individual complaint",
  },
] as const;

export type RiskBand = "low" | "medium" | "high";

export function riskBand(score: number): RiskBand {
  if (score >= 10) return "high";
  if (score >= 5) return "medium";
  return "low";
}

export function riskAcceptanceText(score: number): string {
  const band = riskBand(score);
  if (band === "high") {
    return "Risk requires the approval of the Operations Manager & Safety Director";
  }
  if (band === "medium") {
    return "Risk requires approval by Operations Lead/Supervisor & Safety Manager";
  }
  return "Risk is tolerable, manage at local level";
}

export type PpeResult = "PASS" | "FAIL" | "N/A" | "";
export type PpeRemark = "Clean" | "Repair" | "Replace";

export interface PpeChecklistItemDef {
  id: string;
  group: string;
  description: string;
}

/** One checklist per report — items from HelpDesk+ PPE workbook. */
export const HSQ_PPE_ITEMS: PpeChecklistItemDef[] = [
  { id: "boots_fit", group: "SAFETY BOOTS", description: "Evaluation of fit" },
  { id: "boots_rips", group: "SAFETY BOOTS", description: "Rips, Tear, Cut" },
  { id: "boots_soiling", group: "SAFETY BOOTS", description: "Soiling/Contamination" },
  { id: "boots_toe", group: "SAFETY BOOTS", description: "Damaged or deformed steel toe cap" },
  { id: "boots_sole", group: "SAFETY BOOTS", description: "Deformed or damaged mid-sole, shank" },
  { id: "boots_heel", group: "SAFETY BOOTS", description: "Heel or excessive thread wear" },
  { id: "helmet_fit", group: "HELMET", description: "Evaluation of Fit" },
  { id: "helmet_soiling", group: "HELMET", description: "Soiling" },
  { id: "helmet_shell", group: "HELMET", description: "Damage to shell: crack, dents and abrasion" },
  { id: "helmet_liner", group: "HELMET", description: "Damage to liner: rips, tear, thermal damage" },
  { id: "helmet_cap", group: "HELMET", description: "Damage to impact cap" },
  { id: "harness_labels", group: "FULL BODY / HARNESS", description: "Labels missing or illegible" },
  { id: "harness_webbing", group: "FULL BODY / HARNESS", description: "Cut, frayed, pulled or broken thread on webbing" },
  { id: "harness_dring", group: "FULL BODY / HARNESS", description: "D-ring or buckle deformed, cracked" },
  { id: "harness_plastic", group: "FULL BODY / HARNESS", description: "Cut, broken, excessive wear of plastic parts" },
  { id: "lanyard_webbing", group: "WORK POSITION LANYARDS", description: "General condition of webbing and attachment" },
  { id: "lanyard_hardware", group: "WORK POSITION LANYARDS", description: "Hardware: cracks, wears, separations" },
  { id: "lanyard_rings", group: "WORK POSITION LANYARDS", description: "Three interlocking rings properly connected" },
  { id: "lanyard_pin", group: "WORK POSITION LANYARDS", description: "Slide pin properly engaged through nylon loop" },
  { id: "lanyard_stripe", group: "WORK POSITION LANYARDS", description: "Cracks on torque stripe on the hinge" },
  { id: "gloves_fit", group: "GLOVES", description: "Evaluation of Fit" },
  { id: "gloves_soiling", group: "GLOVES", description: "Soiling" },
  { id: "gloves_rips", group: "GLOVES", description: "Rips, Tears, cuts, thermal damage" },
  { id: "gloves_shrink", group: "GLOVES", description: "Shrinkage" },
  { id: "gloves_flex", group: "GLOVES", description: "Loss of elasticity and flexibility" },
  { id: "goggles_fit", group: "GOGGLES", description: "Evaluation of fit" },
  { id: "goggles_soiling", group: "GOGGLES", description: "Soiling" },
  { id: "goggles_face", group: "GOGGLES", description: "Ripped or torn face" },
  { id: "goggles_lens", group: "GOGGLES", description: "Scratches, pits or broken lens" },
  { id: "overall_fit", group: "OVERALL / RAINCOAT", description: "Evaluation of Fit" },
  { id: "overall_soiling", group: "OVERALL / RAINCOAT", description: "Soiling" },
  { id: "overall_hardware", group: "OVERALL / RAINCOAT", description: "Damage or Missing hardware" },
  { id: "overall_rips", group: "OVERALL / RAINCOAT", description: "Rips, tear, cuts, thermal damage" },
  { id: "overall_stitches", group: "OVERALL / RAINCOAT", description: "Broken or missing stitches" },
  { id: "tools_safe", group: "POWER TOOLS", description: "Are all portable hand or power tools maintained in a safe condition?" },
  { id: "tools_guards", group: "POWER TOOLS", description: "Are power tools equipped and used with guards whenever possible?" },
  { id: "tools_buttons", group: "POWER TOOLS", description: "Is the start and stop buttons in good condition?" },
  { id: "tools_leaks", group: "POWER TOOLS", description: "Is there any leaks on machine?" },
  { id: "tools_cord", group: "POWER TOOLS", description: "Is the power cord in good condition?" },
  { id: "mech_generator", group: "MECHANICAL MACHINES", description: "Is the generator in good condition?" },
  { id: "mech_noise", group: "MECHANICAL MACHINES", description: "Is the noise level high?" },
  { id: "mech_buttons", group: "MECHANICAL MACHINES", description: "Is the start and stop buttons in good condition?" },
  { id: "mech_oil", group: "MECHANICAL MACHINES", description: "Is there Oil leaks on machine?" },
];

export interface PpeAnswer {
  result: PpeResult;
  remarks: PpeRemark[];
}

export type PpeChecklistState = Record<string, PpeAnswer>;

export function emptyPpeChecklist(): PpeChecklistState {
  const out: PpeChecklistState = {};
  for (const item of HSQ_PPE_ITEMS) {
    out[item.id] = { result: "", remarks: [] };
  }
  return out;
}
