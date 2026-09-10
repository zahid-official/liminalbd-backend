import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
  pixelBasedPreset,
} from "react-email";

// Props contract for OTP verification email rendering
interface VerificationEmailProps {
  name: string;
  otp: string;
}

// React Email template for customer OTP verification
const VerificationEmail = ({ name, otp }: VerificationEmailProps) => {
  return (
    <Html lang="en">
      <Head />
      <Preview>Your Liminal Studio verification code: {otp}</Preview>
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                "liminal-secondary": "#44542d",
                "liminal-dark": "#141f0a",
              },
            },
          },
        }}
      >
        <Body className="bg-[#f9f9fa] font-sans py-10">
          <Container className="bg-white max-w-[580px] mx-auto p-12 rounded border border-[#eaeaea] shadow-sm">
            {/* Studio Header */}
            <Section className="text-center pb-6">
              <Text className="text-[32px] font-bold tracking-tight text-[#0a0a0a] m-0">
                Liminal
              </Text>
              <Text className="text-[10px] font-semibold tracking-[0.35em] text-[#737373] uppercase m-0 mt-1">
                Interior Design &amp; Architecture
              </Text>
            </Section>

            <Hr className="border-[#f0f0f0] mb-8" />

            {/* Content Area */}
            <Section className="text-left">
              <Section className="mb-4">
                <Text className="inline-block px-3 py-1 bg-[#edf1e8] text-[#44542d] rounded-full text-[9px] font-bold tracking-[0.25em] uppercase m-0">
                  Spatial Intention • Est. 2020
                </Text>
              </Section>

              <Heading className="text-[26px] font-bold text-[#0a0a0a] leading-tight mb-6">
                Where Vision{" "}
                <span className="italic font-serif font-light text-liminal-secondary">
                  Becomes Presence
                </span>
              </Heading>

              <Text className="text-[15px] leading-relaxed text-[#404040] mb-4">
                Hello <strong className="text-[#0a0a0a]">{name}</strong>,
              </Text>

              <Text className="text-[15px] leading-relaxed text-[#404040] mb-6">
                Thank you for beginning your journey with Liminal Studio. Use
                the one-time verification code below to complete your email
                verification.
              </Text>

              {/* OTP Display Box */}
              <Section className="text-center my-8 bg-[#f6f7f4] border border-[#e2e8dc] rounded-lg py-7 px-4">
                <Text className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#556b2f] m-0 mb-2">
                  Verification Code
                </Text>
                <Text className="text-[34px] font-bold tracking-[0.35em] text-[#141f0a] font-mono m-0">
                  {otp}
                </Text>
              </Section>

              <Text className="text-[13px] leading-normal text-[#555555] mt-6">
                This code is valid for <strong>5 minutes</strong>. For security
                reasons, do not share this code with anyone.
              </Text>

              <Text className="text-[13px] leading-normal text-[#737373] mt-2">
                If you did not request this verification code, you can safely
                disregard this email.
              </Text>
            </Section>

            {/* Studio Footer */}
            <Section className="border-t border-[#f0f0f0] mt-10 pt-6 text-center">
              <Text className="text-[12px] italic font-serif text-[#737373] mb-4">
                &ldquo;We don&rsquo;t decorate rooms. We compose environments
                where every surface, shadow and silence has purpose.&rdquo;
              </Text>
              <Text className="text-[11px] text-[#a3a3a3] mb-1">
                Liminal Interior Design Studio • House Building, Uttara, Dhaka,
                BD
              </Text>
              <Text className="text-[11px] text-[#a3a3a3] m-0">
                © {new Date().getFullYear()} Liminal Interior Design. All rights
                reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export { VerificationEmail };
