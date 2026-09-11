import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
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

// Ultra-luxury architectural email template for Liminal Studio account verification
const VerificationEmail = ({ name, otp }: VerificationEmailProps) => {
  // Format 6-digit OTP into spaced pairs (e.g. 482 · 910 or individual clean cells)
  const otpChars = otp.split("");

  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                "liminal-olive": "#44542d",
                "liminal-olive-light": "#edf1e8",
                "liminal-olive-border": "#d2dcc8",
                "liminal-black": "#0e1309",
                "liminal-charcoal": "#1e221b",
                "liminal-slate": "#4a5247",
                "liminal-muted": "#7a8377",
                "liminal-bg": "#f9f9fa",
                "liminal-card": "#ffffff",
                "liminal-border": "#e6e9e2",
                "liminal-subtle": "#f8f9f6",
              },
              fontFamily: {
                serif: ["'Cormorant Garamond'", "Georgia", "serif"],
                sans: [
                  "'Plus Jakarta Sans'",
                  "-apple-system",
                  "BlinkMacSystemFont",
                  "'Segoe UI'",
                  "Roboto",
                  "sans-serif",
                ],
                mono: ["'Space Mono'", "monospace"],
              },
            },
          },
        }}
      >
        <Head>
          <style>
            {`
              @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&family=Space+Mono:wght@700&display=swap');
              * {
                -webkit-font-smoothing: antialiased;
                -moz-osx-font-smoothing: grayscale;
              }
            `}
          </style>
        </Head>
        <Preview>
          {otp} is your verification code for Liminal Interior Design Studio
        </Preview>
        <Body className="bg-[#F8FAFD] font-sans m-0 py-24 px-4">
          {/* Main Envelope Container */}
          <Container className="max-w-[600px] mx-auto bg-white rounded-xl border border-[#e6e9e2] shadow-[0_12px_40px_rgba(20,31,10,0.06)] overflow-hidden">
            {/* Centered Editorial Brand Bar */}
            <Section className="bg-white px-10 pt-10 text-center">
              <Text className="font-serif text-[36px] font-bold text-[#0e1309] tracking-[-0.01em] leading-[1.1] m-0">
                Liminal
              </Text>
              <Text className="font-sans text-[10px] font-semibold tracking-[0.28em] text-[#6e7769] uppercase leading-none m-0 mt-2 mb-4">
                INTERIOR DESIGN &bull; ARCHITECTURE &bull; FURNITURE
              </Text>
              <Hr className="border-[#ebeee7] m-0" />
            </Section>

            {/* Editorial Header Section */}
            <Section className="px-10 pt-10 pb-5 text-center">
              <Section className="text-center mb-6">
                <Text className="inline-block px-4 py-2 bg-[#EDF1E8] text-[#44542D] border border-[#D2DCC8] rounded-full text-[10.5px] font-bold tracking-[0.25em] uppercase m-0 leading-none">
                  SECURITY VERIFICATION
                </Text>
              </Section>

              <Text className="text-[15px] leading-[1.65] text-[#3b4237] m-0 mb-1 text-left">
                Hello{" "}
                <strong className="text-[#0e1309] font-semibold">{name}</strong>
                ,
              </Text>

              <Text className="text-[15px] leading-[1.65] text-[#555e51] m-0 text-left">
                Thank you for beginning your journey with Liminal Studio. Please
                verify your email using the authorization code below.
              </Text>
            </Section>

            {/* Architectural Highlighted OTP Module */}
            <Section className="px-6 sm:px-10 py-4">
              <Section className="max-w-[440px] mx-auto bg-[#f8f9f6] border border-[#dce3d5] rounded-xl py-6 px-4 text-center">
                <Text className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#44542d] m-0 mb-4">
                  One-Time Verification Code
                </Text>

                {/* Individual Letter-Spaced Digit Cells */}
                <Section className="mb-4">
                  <table
                    align="center"
                    className="mx-auto border-separate [border-spacing:6px]"
                  >
                    <tbody>
                      <tr>
                        {otpChars.map((char, index) => (
                          <td
                            key={index}
                            align="center"
                            valign="middle"
                            className="w-[44px] h-[54px] bg-white border-[1.5px] border-solid border-[#c8d3c0] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.03)]"
                          >
                            <span className="block font-mono text-[26px] font-bold text-[#0e1309] leading-[54px]">
                              {char}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </Section>

                {/* Micro Security Notice Inside Card */}
                <Text className="text-[11.5px] text-[#5c6657] font-medium m-0">
                  Valid for{" "}
                  <strong className="text-[#0e1309]">5 minutes</strong> • Do not
                  share with anyone
                </Text>
              </Section>
            </Section>

            {/* Security Advisory / Reassurance */}
            <Section className="px-10 py-6 text-left">
              <Row className="bg-[#fbfcfb] border-l-2 border-[#44542d] p-4 rounded-r-md">
                <Column>
                  <Text className="text-[12.5px] leading-[1.6] text-[#6b7566] m-0">
                    <strong className="text-[#1e221b]">Security Notice:</strong>{" "}
                    Liminal Studio will never ask for this code over the phone
                    or via social channels. If you did not initiate this
                    registration, please safely ignore this notification.
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Architectural Philosophy Quote */}
            <Section className="px-10 py-6 text-center">
              <Hr className="border-[#ebeee7] m-0 mb-6" />
              <Text className="font-serif text-[13.5px] italic text-[#707a6c] leading-[1.65] m-0 mb-3 text-center">
                &ldquo;We don&rsquo;t decorate rooms. We compose environments
                where every surface, shadow and silence has purpose.&rdquo;
              </Text>
              <Text className="text-[9.5px] font-bold uppercase tracking-[0.3em] text-[#44542d] m-0 text-center">
                Liminal Interior Design
              </Text>
              <Text className="text-[11px] text-[#7a8475] m-0 pb-3 text-center">
                House Building, Sector 3, Uttara, Dhaka, Bangladesh
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export { VerificationEmail };
