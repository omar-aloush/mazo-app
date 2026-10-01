/** Push-token server registration is unused in the opt-in local iOS demo.
 * Local notification scheduling remains handled by expo-notifications.
 */
export async function setAutoServerRegistrationEnabledAsync(): Promise<void> {
  throw new Error('Server push registration is unavailable in the scripted iOS demo.');
}
