import type { CustomerEntity } from 'creem/models/components'
import { CreemError } from 'creem/models/errors'
import { creemClient } from './client'

/**
 * Find the Creem customer for an app user, or create one.
 *
 * The customer is created when the user signs up, not at their first purchase,
 * so the generation wallet exists from day one. `externalId` is the app's own
 * user id, which makes the customer easy to find from either side.
 */
export async function findOrCreateCustomer(user: { id: string; email: string; name: string }): Promise<CustomerEntity> {
  try {
    return await creemClient.customers.retrieve(undefined, user.email)
  } catch (err) {
    if (!(err instanceof CreemError) || err.statusCode !== 404) throw err
  }
  return creemClient.customers.create({ email: user.email, name: user.name || user.email, externalId: user.id })
}
