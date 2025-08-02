export async function lookup (domain) {
    const result = await fetch(`https://www.whois.com/whois/${domain}`);
    const html = await result.text();
    console.log(html)
    console.log('TEST', parse_next(html, 'Registrar:'))
}

function parse_next (html, content) {
    var soup = html.split(content)[1];
    while (true) {
        console.log(soup)
        soup = soup.split('>').splice(1).join('');
        if (soup !== '<') {
            soup = soup.split('<')[0]
            
            break
        } 
    }
    return soup
}

(async () => {
    await lookup('bing.com')
})()
