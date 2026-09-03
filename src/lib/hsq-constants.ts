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
export const HSQ_DEFAULT_TASK = "FTTH";
