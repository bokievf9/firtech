// Echo (the owner's voice assistant) is switched off by default. Set ECHO_ENABLED=1 in the server
// env to bring it back: the Pulse bar and panel, the /admin/echo page and both API routes.
export const echoEnabled = () => process.env.ECHO_ENABLED === '1'
