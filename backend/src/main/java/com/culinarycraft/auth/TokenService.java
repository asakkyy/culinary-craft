package com.culinarycraft.auth;

import com.culinarycraft.persistence.*;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.time.Instant;
import java.util.Base64;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.core.*;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;

@Service
public class TokenService implements JwtDecoder {
    private final NimbusJwtEncoder encoder;
    private final NimbusJwtDecoder decoder;
    private final DemoUserRepository users;
    public TokenService(@Value("${JWT_SECRET}") String secret, DemoUserRepository users) {
        byte[] bytes = Base64.getDecoder().decode(secret);
        if (bytes.length < 32) throw new IllegalArgumentException("JWT_SECRET must contain at least 32 random bytes in Base64");
        var key = new SecretKeySpec(bytes, "HmacSHA256");
        encoder = new NimbusJwtEncoder(new ImmutableSecret<>(key));
        decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer("culinary-craft"),
            new JwtClaimValidator<java.util.List<String>>("aud", value -> value != null && value.contains("culinary-browser"))));
        this.users = users;
    }
    public String issue(DemoUserEntity account) {
        Instant now = Instant.now();
        var claims = JwtClaimsSet.builder().issuer("culinary-craft").audience(java.util.List.of("culinary-browser"))
            .subject(account.getId().toString()).issuedAt(now).expiresAt(now.plusSeconds(1800))
            .claim("uid", account.getId()).claim("version", account.getTokenVersion()).build();
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }
    @Override public Jwt decode(String token) throws JwtException {
        Jwt jwt = decoder.decode(token);
        try {
            var account = users.findById(Long.parseLong(jwt.getSubject())).orElseThrow();
            Number version = jwt.getClaim("version");
            Number uid = jwt.getClaim("uid");
            if (!"ACTIVE".equals(account.getStatus()) || version == null || uid == null
                || uid.longValue() != account.getId() || version.longValue() != account.getTokenVersion()) {
                throw new IllegalArgumentException();
            }
        } catch (RuntimeException error) { throw new BadJwtException("Account session is no longer valid"); }
        return jwt;
    }
}
