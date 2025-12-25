import { useContext } from "react"
import { AgentContext } from "@/contexts/AgentContext"

export function useAgent() {
  const ctx = useContext(AgentContext)
  if (!ctx) {
    throw new Error("useAgent must be used within AgentProvider")
  }
  return ctx
}
