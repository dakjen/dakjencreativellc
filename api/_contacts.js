// Brevo contact storage.
// Contacts go to the Brevo list "DakJen Creative" (id 3) — everyone who has
// shown interest in our services through any form on the site.
// Override with BREVO_LIST_ID if the list is ever rebuilt.

/**
 * Create or update a Brevo contact. Never throws — storing a contact is always
 * secondary to delivering the notification email.
 * @returns {Promise<boolean>} whether the contact was stored
 */
async function addContact({ email, firstName = '', lastName = '', source = 'website' }) {
  if (!process.env.BREVO_API_KEY) return false;

  const attributes = { SOURCE: source };
  if (firstName) attributes.FIRSTNAME = firstName;
  if (lastName) attributes.LASTNAME = lastName;

  const payload = { email, updateEnabled: true, attributes };

  // List 3 = "DakJen Creative" — people who may be interested in our services.
  const listId = parseInt(process.env.BREVO_LIST_ID || '3', 10);
  if (Number.isInteger(listId)) payload.listIds = [listId];

  try {
    const res = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    // 201 created, 204 updated.
    if (res.ok) return true;
    const text = await res.text();
    // Contact already exists and could not be updated — still on the list.
    if (res.status === 400 && text.includes('duplicate_parameter')) return true;
    console.error(`Brevo contacts ${res.status}: ${text}`);
    return false;
  } catch (err) {
    console.error('Brevo contacts request failed:', err.message);
    return false;
  }
}

/** Split a display name into first/last for Brevo attributes. */
function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

module.exports = { addContact, splitName };
