from typing import Dict, List, Literal, Optional
from pydantic import BaseModel


Priority = Literal["low", "medium", "high"]
IssueCategory = Literal[
    "loudness",
    "mix_balance",
    "spectrum",
    "stereo",
    "structure",
    "vocal",
    "bass",
    "drums",
]


class LoudnessMetrics(BaseModel):
    integrated_lufs: float
    short_term_min: float
    short_term_max: float
    true_peak_db: float
    crest_factor_db: float


class StemsBalanceMetrics(BaseModel):
    # livelli medi dei macro elementi
    kick_db: Optional[float] = None
    bass_db: Optional[float] = None
    drums_db: Optional[float] = None
    vocal_db: Optional[float] = None

    # rapporti chiave (differenze in dB)
    kick_vs_bass_db: Optional[float] = None
    clap_vs_kick_db: Optional[float] = None
    vocal_vs_mix_db: Optional[float] = None
    bass_vs_mix_low_db: Optional[float] = None


class SpectrumMetrics(BaseModel):
    # banda larga (valori medi in dB, relativi)
    low_db: float         # 20 - 120 Hz
    lowmid_db: float      # 120 - 400 Hz
    mid_db: float         # 400 - 2k Hz
    high_db: float        # 2k - 10k Hz
    air_db: float         # 10k - 16k Hz

    # quanto si discosta da un reference di genere, in dB
    deviation_from_reference_db: Dict[str, float] = {}


class StereoMetrics(BaseModel):
    global_correlation: float
    low_side_mid_db: float
    mid_side_mid_db: float
    high_side_mid_db: float


class StructureSection(BaseModel):
    type: Literal["intro", "build", "drop", "break", "outro", "other"]
    start_bar: int
    end_bar: int


class StructureMetrics(BaseModel):
    bpm: float
    bars_total: int
    sections: List[StructureSection]


class Issue(BaseModel):
    category: IssueCategory
    priority: Priority
    issue: str
    analysis: str
    suggestion: str


class AnalyzerV1Metrics(BaseModel):
    loudness: LoudnessMetrics
    stems_balance: StemsBalanceMetrics
    spectrum: SpectrumMetrics
    stereo: StereoMetrics
    structure: StructureMetrics


class AnalyzerV1Result(BaseModel):
    version: str = "1.0"
    profile: str  # es: "minimal_deep_tech"
    metrics: AnalyzerV1Metrics
    issues: List[Issue]
