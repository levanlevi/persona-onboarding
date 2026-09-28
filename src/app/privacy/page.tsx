export const metadata = { title: "Privacy · Persona Onboarding Demo" };

export default function Privacy() {
  return (
    <main className="mx-auto max-w-xl px-6 py-16 text-[15px] leading-relaxed text-neutral-700">
      <h1 className="font-serif text-4xl text-neutral-900">Privacy</h1>
      <p className="mt-2 text-sm text-neutral-400">Persona Onboarding Demo, a trial project</p>
      <div className="mt-8 space-y-4">
        <p>
          This is a demo of a conversational onboarding flow. If you connect Google, the app requests read-only
          access to Gmail and reads the sender, subject, date and a short snippet of up to 25 recent inbox emails, once,
          to show you one useful observation.
        </p>
        <p>
          Your Google access token is kept in an encrypted, HTTP-only cookie in your browser for at most one hour. It is
          never stored on our servers. Email content is sent to OpenAI only to generate that observation and is not
          stored.
        </p>
        <p>
          We log anonymous onboarding events (for example &quot;call declined&quot; or &quot;gmail connected&quot;) to
          improve the flow. We don&apos;t log email content.
        </p>
        <p>
          You can disconnect anytime from the demo (&quot;Disconnect Google&quot; or &quot;Restart demo&quot;), or at{" "}
          <a className="text-blue-600 underline" href="https://myaccount.google.com/permissions">
            myaccount.google.com/permissions
          </a>
          .
        </p>
        <p>
          Contact: <a className="text-blue-600 underline" href="mailto:levanlevi@gmail.com">levanlevi@gmail.com</a>
        </p>
      </div>
    </main>
  );
}
