package services.jwtwrapper;

import static com.google.common.truth.Truth.assertThat;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.junit.runners.JUnit4;

import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Collections;

@RunWith(JUnit4.class)
public class RedirectEncodingTest {

    @Test
    public void testResolveTarget_LegacyParam() {
        Map<String, java.util.List<String>> params = new java.util.HashMap<>();
        params.put("redirect_url", java.util.Collections.singletonList("https://old.com"));

        String result = JwtWrapperServer.resolveTarget(params, "https://default.com");
        assertThat(result).isEqualTo("https://old.com");
    }

    @Test
    public void testResolveTarget_NewAlias() {
        Map<String, java.util.List<String>> params = new java.util.HashMap<>();
        params.put("redirect", java.util.Collections.singletonList("https://new.com"));

        String result = JwtWrapperServer.resolveTarget(params, "https://default.com");
        assertThat(result).isEqualTo("https://new.com");
    }

    @Test
    public void testResolveTarget_Precedence() {
        // redirect_url should probably take precedence for backward compat if both
        // exist?
        // Implementation: `if (params.containsKey("redirect_url")) ... else if
        // ("redirect")`
        Map<String, java.util.List<String>> params = new java.util.HashMap<>();
        params.put("redirect_url", java.util.Collections.singletonList("https://primary.com"));
        params.put("redirect", java.util.Collections.singletonList("https://secondary.com"));

        String result = JwtWrapperServer.resolveTarget(params, "https://default.com");
        assertThat(result).isEqualTo("https://primary.com");
    }

    @Test
    public void testResolveTarget_Default() {
        Map<String, java.util.List<String>> params = new java.util.HashMap<>();
        String result = JwtWrapperServer.resolveTarget(params, "https://default.com");
        assertThat(result).isEqualTo("https://default.com");
    }

    @Test
    public void testGenerateHtml_Escaping() {
        String dangerousUrl = "https://evil.com/\" + alert(1) + \""; // " -> \"
        String html = JwtWrapperServer.generateRedirectHtml(dangerousUrl);

        assertThat(html).contains("var target = \"https://evil.com/\\\" + alert(1) + \\\"\";");
        assertThat(html).doesNotContain("var target = \"https://evil.com/\" + alert(1) + \"\"");
    }

    @Test
    public void testGenerateHtml_ScriptTag() {
        String scriptUrl = "https://example.com/foo</script><script>alert(1)</script>";
        String html = JwtWrapperServer.generateRedirectHtml(scriptUrl);

        // Should escape </script> to <\/script>
        assertThat(html).contains("<\\/script>");
        assertThat(html).doesNotContain("</script><script>");
    }
}
