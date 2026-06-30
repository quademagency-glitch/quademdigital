/**
 * Submit all known URLs to IndexNow
 */

async function main() {
  const host = "quademdigital.com";
  const key = "quademdigital2025indexnow";
  const keyLocation = `https://${host}/${key}.txt`;

  // Fetch the sitemap to get the URLs dynamically if we want, or hardcode.
  // Since we know the site has a sitemap at /sitemap-0.xml, we can fetch it, 
  // but it's generated dynamically by Astro in prod. Let's just fetch it from production.
  
  try {
    console.log("Fetching sitemap from production...");
    const res = await fetch(`https://${host}/sitemap.xml`);
    if (!res.ok) {
      throw new Error(`Failed to fetch sitemap: ${res.statusText}`);
    }
    const xml = await res.text();
    
    // Quick regex to extract <loc> URLs
    const matches = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)];
    const urlList = matches.map(m => m[1]);

    console.log(`Found ${urlList.length} URLs in the sitemap.`);

    if (urlList.length === 0) {
      console.log("No URLs found to submit.");
      return;
    }

    const payload = {
      host: host,
      key: key,
      keyLocation: keyLocation,
      urlList: urlList
    };

    console.log("Submitting to IndexNow...");
    
    const indexNowRes = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    if (indexNowRes.ok) {
      console.log("✅ Successfully submitted URLs to IndexNow!");
    } else {
      console.error("❌ Failed to submit to IndexNow", indexNowRes.status, await indexNowRes.text());
    }

  } catch (error) {
    console.error("Error submitting to IndexNow:", error);
  }
}

main();
