
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Smile, Send, RotateCcw, Upload, Globe, FileText, Database } from "lucide-react";

export default function AIAgent() {
  const [message, setMessage] = useState("");

  return (
    <div className="grid grid-cols-12 gap-6 p-6">
      {/* LEFT */}
      <div className="col-span-5 space-y-6">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Agent Settings</h2>

          <div>
            <label className="text-xs text-muted-foreground">Role</label>
            <Select>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Customer Support" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sales">Sales Agent</SelectItem>
                <SelectItem value="support">Customer Support</SelectItem>
                <SelectItem value="orders">Order Assistant</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Tone</label>
            <Select>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Friendly" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="friendly">Friendly</SelectItem>
                <SelectItem value="professional">Professional</SelectItem>
                <SelectItem value="formal">Formal</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Rules</label>
            <Textarea
              className="mt-1 min-h-[120px] bg-muted/40"
              placeholder="Always be concise, polite, and helpful..."
            />
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold text-lg">Knowledge Sources</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="border rounded-xl p-4 hover:shadow transition">
              <FileText className="h-5 w-5 mb-2" />
              <p className="font-medium text-sm">Files</p>
              <p className="text-xs text-muted-foreground">PDF, DOCX, TXT</p>
            </div>

            <div className="border rounded-xl p-4 hover:shadow transition">
              <Globe className="h-5 w-5 mb-2" />
              <p className="font-medium text-sm">Website</p>
              <p className="text-xs text-muted-foreground">Crawl pages</p>
            </div>

            <div className="border rounded-xl p-4 hover:shadow transition">
              <Database className="h-5 w-5 mb-2" />
              <p className="font-medium text-sm">Text</p>
              <p className="text-xs text-muted-foreground">Paste content</p>
            </div>

            <div className="border rounded-xl p-4 hover:shadow transition opacity-50">
              <Upload className="h-5 w-5 mb-2" />
              <p className="font-medium text-sm">Notion</p>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT */}
      <div className="col-span-7">
        <Card className="h-full flex flex-col rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-500 text-white">
            <span className="text-sm font-semibold">Agent Playground</span>
            <RotateCcw className="h-4 w-4 hover:rotate-180 transition" />
          </div>

          <div className="flex-1 bg-[#ECEBE7] p-4 space-y-3">
            <div className="bg-[#E0DED9] rounded-2xl px-4 py-3 max-w-[75%] animate-in fade-in slide-in-from-bottom-2">
              <p className="text-sm">Hi! How can I help you today?</p>
            </div>
          </div>

          <div className="p-3 bg-white">
            <div className="flex items-center gap-2 rounded-full border px-3 py-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message..."
                className="border-0 focus-visible:ring-0"
              />
              <Smile className="h-5 w-5 text-muted-foreground" />
              <Send className="h-5 w-5 hover:scale-110 transition" />
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
