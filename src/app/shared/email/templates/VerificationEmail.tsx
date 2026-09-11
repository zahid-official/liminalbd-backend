import {
  Body,
  Column,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
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

// Social media channels configuration
const SOCIAL_LINKS = [
  {
    name: "Facebook",
    href: "https://facebook.com/liminalbd",
    iconUrl: "https://cdn-icons-png.flaticon.com/512/733/733547.png",
  },
  {
    name: "Instagram",
    href: "https://instagram.com/liminalbd",
    iconUrl: "https://cdn-icons-png.flaticon.com/512/733/733558.png",
  },
  {
    name: "X (Twitter)",
    href: "https://x.com/liminalbd",
    iconUrl: "https://cdn-icons-png.flaticon.com/512/5969/5969020.png",
  },
  {
    name: "WhatsApp",
    href: "https://wa.me/8801700000000",
    iconUrl: "https://cdn-icons-png.flaticon.com/512/733/733585.png",
  },
];

// Verification email template for Liminal Interior Design Studio
const VerificationEmail = ({ name, otp }: VerificationEmailProps) => {
  const otpChars = otp.split("");

  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                "liminal-white": "#FFFFFF",
                "liminal-black": "#000000",
                "liminal-border": "#DCE3D5",
                "liminal-secondary": "#44542d",
                "liminal-olive": "#5c6657",
                "liminal-olive-dark": "#2A3D1A",
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
          <meta name="color-scheme" content="light" />
          <meta name="supported-color-schemes" content="light" />
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
          <Container className="max-w-[600px] mx-auto bg-white rounded-xl border border-liminal-border shadow-[0_12px_40px_rgba(20,31,10,0.06)] overflow-hidden">
            {/* Studio Header */}
            <Section className="bg-white px-10 pt-10 text-center">
              <Text className="font-serif text-[36px] font-bold tracking-[-0.01em] leading-[1.1] m-0">
                Liminal
              </Text>
              <Text className="text-[10.5px] font-bold tracking-[0.25em] text-liminal-secondary uppercase leading-none m-0 mt-2 mb-4">
                INTERIOR DESIGN &bull; ARCHITECTURE &bull; FURNITURE
              </Text>
              <Hr className="border-t-liminal-border m-0" />
            </Section>

            {/* Email Content */}
            <Section className="px-10 pt-10 pb-2 text-liminal-olive">
              <Section className="text-center mb-6">
                <Text className="inline-block px-4 py-3 bg-liminal-olive-dark text-liminal-white rounded-full text-[10.5px] font-bold tracking-[0.25em] uppercase m-0 leading-none">
                  ACCOUNT VERIFICATION
                </Text>
              </Section>

              <Text className="text-[15px] leading-[1.5] mb-2.5">
                Hello{" "}
                <strong className="text-liminal-black font-semibold">
                  {name}
                </strong>
                ,
              </Text>

              <Text className="text-[15px] leading-[1.5] m-0">
                Thank you for beginning your journey with Liminal Studio. Please
                verify your email using the authorization code below.
              </Text>
            </Section>

            <Section className="px-6 sm:px-10 py-4">
              <Section className="max-w-[440px] mx-auto bg-[#F8F9F6] border border-liminal-border rounded-xl py-6 px-4 text-center">
                <Text className="text-[10px] font-bold uppercase tracking-[0.25em] text-liminal-secondary m-0 mb-2.5">
                  One-Time Verification Code
                </Text>

                {/* OTP Display Box */}
                <Section className="mb-3">
                  <table
                    align="center"
                    className="mx-auto border-separate [border-spacing:8px] min-w-fit whitespace-nowrap"
                  >
                    <tbody>
                      <tr>
                        {otpChars.map((char, index) => (
                          <td
                            key={index}
                            align="center"
                            valign="middle"
                            className="w-[44px] h-[48px] bg-white border-[1.5px] border-solid border-[#C8D3C0] rounded-lg shadow-[0_2px_4px_rgba(0,0,0,0.03)]"
                          >
                            <span className="block font-mono text-[26px] font-bold leading-[48px]">
                              {char}
                            </span>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </Section>

                <Text className="text-[11.5px] text-liminal-olive font-medium m-0">
                  Valid for{" "}
                  <strong className="text-liminal-black pl-0.25">
                    5 minutes
                  </strong>
                  <span className="px-1">&bull;</span>
                  Do not share with anyone
                </Text>
              </Section>
            </Section>

            <Section className="px-10 py-4 text-left">
              <Row className="bg-[#FBFCFB] border-l-2 border-liminal-secondary p-4 rounded-r-md">
                <Column>
                  <Text className="text-[13px] leading-[1.5] text-liminal-olive m-0">
                    <strong className="text-liminal-black font-bold pr-0.5">
                      Security Notice:
                    </strong>{" "}
                    Liminal Studio will never ask for your verification code. If
                    you did not initiate this registration, please safely ignore
                    this notification.
                  </Text>
                </Column>
              </Row>
            </Section>

            {/* Studio Footer */}
            <Section className="px-10 py-4 text-center text-liminal-olive">
              <Hr className="border-liminal-border m-0 mb-4" />
              <Text className="font-serif text-[14px] italic leading-[1.5] m-0 mb-2 text-center">
                &ldquo;At Liminal, we don&rsquo;t decorate rooms. We compose
                environments <br /> where every surface, shadow and silence has
                purpose.&rdquo;
              </Text>

              {/* Social Media Links */}
              <Section className="text-center">
                <table
                  align="center"
                  className="mx-auto border-separate [border-spacing:14px]"
                >
                  <tbody>
                    <tr>
                      {SOCIAL_LINKS.map((social) => (
                        <td key={social.name} align="center" valign="middle">
                          <Link
                            href={social.href}
                            target="_blank"
                            className="inline-block"
                          >
                            <Img
                              src={social.iconUrl}
                              width="20"
                              height="20"
                              alt={social.name}
                              className="opacity-85 hover:opacity-100"
                            />
                          </Link>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </Section>

              <Text className="text-[11px] font-bold uppercase tracking-[0.25em] text-liminal-secondary m-0 text-center">
                Liminal Interior Design
              </Text>
              <Text className="text-[11px] m-0 text-center">
                House Building, Sector 3, Uttara, Dhaka, Bangladesh
              </Text>
              <Text className="text-[10px] text-liminal-olive/80 m-0 mt-1.5 pb-4">
                &copy; {new Date().getFullYear()} Liminal Interior Design.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export { VerificationEmail };
