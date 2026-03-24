"use client";

import { useState, useEffect, useCallback } from "react";
import type { Contact, DashboardStats } from "@/lib/types";

interface EmailResult {
  email: string;
  success: boolean;
  error?: string;
}

interface SendResult {
  campaignId?: string;
  results: EmailResult[];
  succeeded: number;
  failed: number;
  total: number;
  error?: string;
}

// ---------- Stat Card ----------
function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color ?? "text-gray-900"}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ---------- Main Page ----------
export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [contactsLoading, setContactsLoading] = useState(true);

  // New contact form
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [addingContact, setAddingContact] = useState(false);
  const [addError, setAddError] = useState("");

  // Cron toggle
  const [cronActive, setCronActive] = useState(false);
  const [cronToggling, setCronToggling] = useState(false);

  // Compose / send
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [fromName, setFromName] = useState("Aidan McKenzie");
  const [customEmails, setCustomEmails] = useState("");
  const [sendToAll, setSendToAll] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendResult | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) setStats(await res.json());
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) setContacts(await res.json());
    } finally {
      setContactsLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setCronActive(data.cron_active === "true");
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchContacts();
    fetchSettings();
  }, [fetchStats, fetchContacts, fetchSettings]);

  async function handleToggleCron() {
    setCronToggling(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "cron_active", value: cronActive ? "false" : "true" }),
      });
      if (res.ok) setCronActive(!cronActive);
    } finally {
      setCronToggling(false);
    }
  }

  async function handleAddContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newEmail) return;
    setAddingContact(true);
    setAddError("");
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: newEmail, name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Failed to add contact");
      } else {
        setContacts((prev) => [data, ...prev]);
        setNewEmail("");
        setNewName("");
      }
    } finally {
      setAddingContact(false);
    }
  }

  async function handleDeleteContact(id: string) {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    setContacts((prev) => prev.filter((c) => c.id !== id));
  }

  const emailsToSend = sendToAll
    ? contacts.filter((c) => c.status === "active").map((c) => c.email)
    : [
        ...contacts.filter((c) => c.status === "active").map((c) => c.email),
        ...customEmails
          .split(/[\n,]+/)
          .map((e) => e.trim())
          .filter((e) => e.includes("@")),
      ].filter(Boolean);

  const uniqueEmails = [...new Set(emailsToSend)];

  async function handleSend() {
    if (uniqueEmails.length === 0 || !subject || !message) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: uniqueEmails,
          subject,
          message,
          fromName,
        }),
      });
      const data = await res.json();
      setSendResult(data);
      if (res.ok) {
        fetchStats();
      }
    } catch {
      setSendResult({ results: [], succeeded: 0, failed: 0, total: 0, error: "Network error" });
    } finally {
      setSending(false);
    }
  }

  const activeContacts = contacts.filter((c) => c.status === "active").length;

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Email Sender</h1>
            <p className="text-sm text-gray-500 mt-0.5">Powered by Resend</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">Auto-send</span>
            <button
              onClick={handleToggleCron}
              disabled={cronToggling}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                cronActive ? "bg-green-500" : "bg-gray-300"
              } ${cronToggling ? "opacity-50" : ""}`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  cronActive ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-xs font-medium ${cronActive ? "text-green-600" : "text-gray-400"}`}>
              {cronActive ? "Active" : "Inactive"}
            </span>
          </div>
        </div>

        {/* ── Stats ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Overview
          </h2>
          {statsLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse h-24" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label="Sent Today" value={stats?.sentToday ?? 0} sub="emails" />
              <StatCard label="Total Sent" value={stats?.sentTotal ?? 0} sub="all time" />
              <StatCard
                label="Open Rate"
                value={`${stats?.openRate ?? 0}%`}
                color={
                  (stats?.openRate ?? 0) >= 20
                    ? "text-green-600"
                    : (stats?.openRate ?? 0) >= 10
                    ? "text-yellow-600"
                    : "text-gray-900"
                }
              />
              <StatCard
                label="Bounce Rate"
                value={`${stats?.bounceRate ?? 0}%`}
                color={(stats?.bounceRate ?? 0) > 5 ? "text-red-600" : "text-gray-900"}
              />
              <StatCard
                label="Reply Rate"
                value={`${stats?.replyRate ?? 0}%`}
                color={(stats?.replyRate ?? 0) > 0 ? "text-green-600" : "text-gray-900"}
              />
            </div>
          )}
        </section>

        {/* ── Contact List ── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
              Contacts
            </h2>
            <span className="text-xs text-gray-500">
              {activeContacts} active · {contacts.length} total
            </span>
          </div>

          {/* Add contact form */}
          <form onSubmit={handleAddContact} className="flex gap-2 mb-4">
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="email@example.com"
              required
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name (optional)"
              className="w-40 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              type="submit"
              disabled={addingContact || !newEmail}
              className="bg-black text-white text-sm px-4 py-2 rounded-lg hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {addingContact ? "Adding..." : "Add"}
            </button>
          </form>
          {addError && <p className="text-xs text-red-500 mb-3">{addError}</p>}

          {/* Contact table */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {contactsLoading ? (
              <div className="p-6 text-center text-sm text-gray-400">Loading contacts...</div>
            ) : contacts.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No contacts yet. Add one above.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Name</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Added</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, i) => (
                    <tr
                      key={contact.id}
                      className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${
                        i === contacts.length - 1 ? "border-0" : ""
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">{contact.email}</td>
                      <td className="px-4 py-3 text-gray-600">{contact.name ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            contact.status === "active"
                              ? "bg-green-50 text-green-700"
                              : contact.status === "bounced"
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {contact.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDeleteContact(contact.id)}
                          className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── Compose & Send ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
            Send Campaign
          </h2>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Name</label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your email..."
                rows={7}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black resize-none"
              />
            </div>

            {/* Recipients */}
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-gray-600">Recipients</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendToAll}
                  onChange={(e) => setSendToAll(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-700">
                  Send to all active contacts ({activeContacts})
                </span>
              </label>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {sendToAll ? "Additional emails (optional)" : "Additional emails"}
                </label>
                <textarea
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  placeholder={"Paste emails separated by commas or new lines"}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black resize-none"
                />
              </div>
              <p className="text-xs text-gray-400">
                {uniqueEmails.length} unique recipient{uniqueEmails.length !== 1 ? "s" : ""}
              </p>
            </div>

            <button
              onClick={handleSend}
              disabled={sending || uniqueEmails.length === 0 || !subject || !message}
              className="w-full bg-black text-white rounded-lg py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {sending
                ? `Sending to ${uniqueEmails.length} recipient${uniqueEmails.length !== 1 ? "s" : ""}...`
                : `Send to ${uniqueEmails.length} recipient${uniqueEmails.length !== 1 ? "s" : ""}`}
            </button>
          </div>

          {/* Send result */}
          {sendResult && (
            <div className="mt-4 bg-white border border-gray-200 rounded-2xl p-5">
              {sendResult.error ? (
                <p className="text-sm text-red-600">{sendResult.error}</p>
              ) : (
                <>
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-green-700">{sendResult.succeeded}</div>
                      <div className="text-xs text-green-600 mt-1">Sent</div>
                    </div>
                    <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-red-700">{sendResult.failed}</div>
                      <div className="text-xs text-red-600 mt-1">Failed</div>
                    </div>
                    <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                      <div className="text-2xl font-bold text-gray-700">{sendResult.total}</div>
                      <div className="text-xs text-gray-500 mt-1">Total</div>
                    </div>
                  </div>
                  {sendResult.failed > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-600 mb-1">Failed:</p>
                      <ul className="space-y-0.5">
                        {sendResult.results
                          .filter((r) => !r.success)
                          .map((r) => (
                            <li key={r.email} className="text-xs text-red-600 font-mono">
                              {r.email} — {r.error}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
