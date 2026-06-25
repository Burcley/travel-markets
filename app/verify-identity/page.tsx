"use client";

import { useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function VerifyIdentityPage() {
  const supabase = createClient();

  const [fullLegalName, setFullLegalName] = useState("");
  const [documentType, setDocumentType] = useState("student_id");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  async function notifyAdminsIdentitySubmitted(name: string) {
    try {
      const response = await fetch("/api/emails/admin-identity-submitted", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullLegalName: name,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        console.error("ADMIN IDENTITY SUBMITTED API ERROR:", data);
      }
    } catch (error) {
      console.error("ADMIN IDENTITY SUBMITTED FETCH ERROR:", error);
    }
  }

  async function submitVerification() {
    try {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please log in first.");
      if (!fullLegalName.trim()) throw new Error("Enter your legal name.");
      if (!documentFile) throw new Error("Upload your document.");

      const docPath = `${user.id}/${crypto.randomUUID()}-${documentFile.name}`;

      const { error: docError } = await supabase.storage
        .from("verification-documents")
        .upload(docPath, documentFile, {
          upsert: false,
        });

      if (docError) throw docError;

      let selfiePath: string | null = null;

      if (selfieFile) {
        selfiePath = `${user.id}/${crypto.randomUUID()}-${selfieFile.name}`;

        const { error: selfieError } = await supabase.storage
          .from("verification-documents")
          .upload(selfiePath, selfieFile, {
            upsert: false,
          });

        if (selfieError) throw selfieError;
      }

      const { data: docSigned } = await supabase.storage
        .from("verification-documents")
        .createSignedUrl(docPath, 60 * 60 * 24 * 7);

      const { data: selfieSigned } = selfiePath
        ? await supabase.storage
            .from("verification-documents")
            .createSignedUrl(selfiePath, 60 * 60 * 24 * 7)
        : { data: null };

      const { error: insertError } = await supabase
        .from("identity_verifications")
        .insert({
          user_id: user.id,
          full_legal_name: fullLegalName.trim(),
          document_type: documentType,
          document_url: docSigned?.signedUrl || docPath,
          selfie_url: selfieSigned?.signedUrl || selfiePath,
          status: "pending",
        });

      if (insertError) throw insertError;

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          identity_verified: false,
          identity_verification_status: "pending",
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      await notifyAdminsIdentitySubmitted(fullLegalName.trim());

      alert("Verification submitted successfully. Admin will review it shortly.");

      window.location.href = "/dashboard";
    } catch (error) {
      console.error("IDENTITY VERIFICATION ERROR:", error);

      alert(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-black px-4 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-zinc-950 p-6 shadow-2xl">
        <div className="mb-8 flex items-center gap-3">
          <div className="rounded-2xl bg-emerald-500/10 p-3 text-emerald-400">
            <ShieldCheck className="h-6 w-6" />
          </div>

          <div>
            <h1 className="text-2xl font-bold">Identity Verification</h1>

            <p className="text-sm text-zinc-400">
              Upload a student ID, passport, driver&apos;s license, or another
              valid document.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Full legal name
            </label>

            <input
              value={fullLegalName}
              onChange={(e) => setFullLegalName(e.target.value)}
              placeholder="Enter your full legal name"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Document type
            </label>

            <select
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 outline-none focus:border-emerald-500"
            >
              <option value="student_id">Student ID</option>
              <option value="drivers_license">Driver&apos;s License</option>
              <option value="passport">Passport</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Document image
            </label>

            <input
              type="file"
              accept="image/*,.pdf"
              onChange={(e) => setDocumentFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-300">
              Selfie image (optional)
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setSelfieFile(e.target.files?.[0] || null)}
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-sm"
            />
          </div>

          <button
            onClick={submitVerification}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Verification
          </button>
        </div>
      </div>
    </main>
  );
}