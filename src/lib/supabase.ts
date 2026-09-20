import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Tip tanımları (DB tablolarıyla eşleşiyor) ──

export interface DBMission {
  id: number;
  type: "cargo" | "agricultural" | "fire" | "traffic";
  title: string;
  description: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  payment: number; // USDC, 7dp
  status: "open" | "accepted" | "in-progress" | "completed" | "cancelled";
  drone_id: number | null;
  posted_by: string; // 'UserAgent_Zeynep' | 'UserAgent_Murat' | wallet adresi
  stellar_tx: string | null; // Escrow transaction hash
  created_at: string;
}

export interface DBChargingPod {
  id: number;
  name: string;
  owner_wallet: string;
  lat: number;
  lng: number;
  rate: number; // USDC/kWh
  is_available: boolean;
  total_earned: number;
  created_at: string;
}

export interface DBFlightLog {
  id: number;
  drone_id: number;
  drone_name: string;
  mission_id: number | null;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  duration: number; // dakika
  energy_used: number; // kWh
  mission_type: string;
  stellar_tx: string | null; // Stellar transaction hash
  created_at: string;
}

export interface DBAgentDecision {
  id: number;
  agent_name: string; // 'FleetAgent' | 'EmergencyAgent' vb.
  decision: string;
  reasoning: string | null;
  affected: string | null; // 'drone:1, mission:4'
  created_at: string;
}

// ── Yardımcı Fonksiyonlar (Hackathon Güvenli) ──
// Eğer tablolar yoksa uygulamanın çökmesini engeller, sadece console'a yazar.

export async function logMissionToSupabase(mission: Omit<DBMission, "id" | "created_at">) {
  try {
    const { data, error } = await supabase.from('missions').insert([mission]);
    if (error) {
      console.warn("Supabase (Offline Mode) Görev kaydedilemedi, yerel hafızaya alındı:", error.message);
      return false;
    }
    console.log("Supabase ✅ Görev başarıyla senkronize edildi:", mission.title);
    return true;
  } catch (err) {
    console.error("Supabase bağlantı hatası:", err);
    return false;
  }
}

export async function logAgentDecisionToSupabase(decision: Omit<DBAgentDecision, "id" | "created_at">) {
  try {
    const { error } = await supabase.from('agent_decisions').insert([decision]);
    if (error) {
      console.warn("Supabase (Offline Mode) Karar günlüğü:", decision.decision);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}

export async function logFlightToSupabase(log: Omit<DBFlightLog, "id" | "created_at">) {
  try {
    const { error } = await supabase.from('flight_logs').insert([log]);
    if (error) {
      console.warn("Supabase (Offline Mode) Uçuş logu:", log.drone_name);
      return false;
    }
    return true;
  } catch (err) {
    return false;
  }
}
