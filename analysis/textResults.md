Total juegos terminados: 27
Tasa de engaño (Claude engañó a P1): 12/27 = 44.4%

resultado
P1 acierta (detectó a Claude)    15
P1 falla (Claude engañó)         12

TIEMPO DE RESPUESTA (importante)
Estadísticas por responder:
           count  mean   std  min   25%   50%   75%    max
responder                                                 
claude     139.0  22.7  15.0  3.2   8.8  22.6  30.3   89.2
p1         170.0  27.6  21.8  1.1  14.0  21.1  33.7  138.2
p2         108.0  28.8  27.3  1.4  11.9  22.1  33.3  144.9

Promedio de palabras por sender:
        count  mean   std  min  25%  50%   75%    max
sender                                               
claude  139.0  17.8  20.8  1.0  3.0  9.0  27.5  129.0
p2      112.0   6.9  24.3  1.0  1.0  3.0   6.0  256.0

Correlación (Pearson) lessons_count vs claude_wins:    0.955
Correlación (Pearson) weighted_lessons vs claude_wins: 0.959

Duración promedio por resultado: especificar unidades joder, no usar todos los datos
                               count  mean   std   min   25%   50%   75%  \
resultado                                                                  
P1 acierta (detectó a Claude)   15.0  4.37  2.82  0.57  2.84  3.19  4.97   
P1 falla (Claude engañó)        12.0  4.64  2.87  0.86  2.74  4.06  5.72   

                                 max  
resultado                             
P1 acierta (detectó a Claude)  10.85  
P1 falla (Claude engañó)       10.27  

ANÁLISIS LINGUÍSTICO SUPER IMPORTANTE
Comparación lingüística Claude vs P2 (promedios):
============================================================
witness             claude  human
words               17.820  6.938
exclamations         0.129  0.071
questions            0.309  0.241
emojis               0.151  0.045
uppercase_ratio      0.018  0.090
starts_lowercase     0.669  0.232
ends_without_punct   0.619  0.688

Uso de slang mexicano:
witness
claude    0.266
human     0.027
Name: has_typo_indicators, dtype: float64