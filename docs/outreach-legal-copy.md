# Outreach: the exact copy to publish

Written 21 August 2026. **Not legal advice.** Ernest should have someone qualified read
this before the first send. It is written to be accurate and plain rather than to sound
lawyerly, because a recipient who cannot understand it is not actually informed.

Postal address, confirmed by Ernest and to be used verbatim everywhere:

```
18th Ahmadiyyah Avenue, Lakeside, Accra, Ghana
```

It goes in three places: the site footer, every cold email signature, and the two pages
below. It is already in `quadem-sequences.md`.

---

## 1. Add to `src/pages/privacy-policy.astro`

A new section. Do not reword it to sound more formal.

> ### Businesses we contact who have not contacted us
>
> We approach businesses directly to offer our services. If you have had an email from
> us and never asked for one, this section explains why.
>
> **What we hold.** The business name, a business email address, a business phone
> number, the website address, the town, and notes about the website itself, such as
> whether it uses a secure connection or links to social media accounts.
>
> **Where it came from.** Public sources only. Business listings, directories, and the
> businesses' own websites. We do not buy contact lists and we do not use personal
> email addresses where we can tell them apart from business ones.
>
> **Why we are allowed to hold it.** We rely on legitimate interests: offering services
> that are relevant to a business we believe could use them. We have weighed that
> against the interruption of an unexpected email, which is why we contact businesses
> rather than individuals, keep the messages short, and stop immediately when asked.
>
> **How long we keep it.** Up to twelve months from collection, or until you ask us to
> remove it, whichever comes first. If you tell us to stop, we keep only enough
> information to make sure we never contact you again.
>
> **How to stop it.** Reply to any email from us and say so, or write to
> ernest@quademdigital.com. We will remove you and not write again. You do not have to
> give a reason, and there is nothing to click.
>
> **Your other rights.** You can ask what we hold about you, ask us to correct it, ask
> us to delete it, and object to us holding it at all. Write to
> ernest@quademdigital.com and we will answer within thirty days.
>
> Quadem Digital, 18th Ahmadiyyah Avenue, Lakeside, Accra, Ghana.

---

## 2. New page at `/privacy/outreach`

Route: `src/pages/privacy/outreach.astro`. Short by design, linked from the signature
of every cold email from email 2 onwards.

Title: **Why you got an email from us**
Meta description: *Where we got your details, why we wrote to you, and how to stop it.*

> # Why you got an email from us
>
> If you had an email from me and never asked for one, this page explains it. It should
> take a minute to read.
>
> ## Who I am
>
> I am Ernest. I run Quadem Digital, a small studio in Accra, Ghana. There is no sales
> team. The email came from me.
>
> ## Where I got your details
>
> From public sources. Your business listing, your own website, or a public directory.
> I did not buy a list and nobody passed your details on to me.
>
> ## Why I wrote to you
>
> I look at business websites and check a handful of basic things: whether the site
> loads securely, whether it works properly on a phone, whether it is set up so Google
> can describe it. When I find something worth mentioning, I write to the owner about
> that specific thing.
>
> If my email mentioned something about your website, that is where it came from. I
> looked at your site before writing.
>
> ## What I do not do
>
> I do not sell your details, share them, or add you to a newsletter. I do not use
> tracking pixels in a first email. I do not send the same message to thousands of
> people with the name swapped.
>
> ## How to make it stop
>
> Reply and say so. Anything will do. "No thanks" is enough. I will remove you and you
> will not hear from me again.
>
> You can also write to ernest@quademdigital.com. If you would rather I deleted
> everything I hold about your business, say that and I will, then confirm it is done.
>
> ## If you want to know more
>
> The full detail is in the [privacy policy](/privacy-policy/). You can ask what I hold
> about you, ask me to correct or delete it, or object to my holding it at all.
>
> Ernest, Quadem Digital
> 18th Ahmadiyyah Avenue, Lakeside, Accra, Ghana
> ernest@quademdigital.com

**Build notes.** Use `BaseLayout`. No booking link, no services pitch, no navigation
into the sales pages beyond the normal site nav. The moment this page tries to sell
something it stops doing its job, which is to make an annoyed stranger feel dealt with
honestly. Add it to the sitemap.

---

## 3. Footer

The postal address needs to appear in the site footer as well. It is in `BaseLayout`.

---

## One decision for Ernest, not for a developer

That street address is about to appear in roughly a thousand emails and on a public
page, permanently and unremovably. Once it is out, it is out.

US CAN-SPAM accepts a registered post office box as a valid physical address. If 18th
Ahmadiyyah Avenue is a home rather than a commercial office, a PO box is worth the
small cost and gives exactly the same legal standing.

This is not a reason to delay. It is a five-minute decision worth making once, on
purpose, rather than discovering later that it cannot be undone.
